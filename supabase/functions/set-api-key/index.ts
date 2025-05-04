
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Parse the request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { name, key, service } = body;
    
    // Validate input
    if (!name || !key || !service) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing required fields: name, key, and service are required'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set up Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase URL or service role key");
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Generate a masked version of the API key for display
    const firstChars = key.substring(0, 3);
    const lastChars = key.substring(key.length - 4);
    const maskedLength = Math.min(key.length - 7, 10);
    const keyMasked = `${firstChars}${'•'.repeat(maskedLength)}${lastChars}`;
    
    // Store API key in the project secrets
    let secretName = '';
    let secretStored = false;
    
    try {
      switch (service.toLowerCase()) {
        case 'perplexity':
          secretName = 'PERPLEXITY_API_KEY';
          break;
        case 'openai':
          secretName = 'OPENAI_API_KEY';
          break;
        case 'fred':
          secretName = 'FRED_API_KEY';
          break;
        case 'hubspot':
          secretName = 'HUBSPOT_API_KEY';
          break;
        default:
          secretName = `${service.toUpperCase()}_API_KEY`;
      }
      
      // Extract project ID from the URL
      const urlParts = supabaseUrl.split('.');
      if (urlParts.length < 3) {
        throw new Error(`Invalid SUPABASE_URL format: ${supabaseUrl}`);
      }
      
      const projectId = urlParts[0].replace('https://', '');
      if (!projectId) {
        throw new Error('Could not extract project ID from SUPABASE_URL');
      }
      
      // Get admin key
      const adminKey = Deno.env.get('SB_ADMIN_KEY');
      if (!adminKey) {
        throw new Error('Missing SB_ADMIN_KEY. Please add this secret to your Supabase Edge Function secrets.');
      }
      
      console.log(`Setting secret ${secretName} for project ${projectId}`);
      
      // Store the secret using Admin API
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/secrets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: secretName,
          value: key
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to set secret: ${response.status} ${response.statusText}`);
        console.error(`Error details: ${errorText}`);
        throw new Error(`Failed to set secret: ${response.status} ${response.statusText}`);
      }
      
      secretStored = true;
      console.log(`Successfully stored ${secretName}`);
    } catch (secretError) {
      console.error('Error setting secret:', secretError);
      // We'll continue with the database storage even if setting the secret fails
      // but we'll include a warning in the response
      console.warn('Secret storage failed but continuing with database storage');
    }
    
    // Ensure the api_keys table exists
    try {
      // Check if table exists
      const { error: checkError } = await supabase
        .from('api_keys')
        .select('count')
        .limit(1);
        
      if (checkError && checkError.message.includes('relation "public.api_keys" does not exist')) {
        console.log("Creating api_keys table as it doesn't exist");
        
        // Create the table directly
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS public.api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            service TEXT NOT NULL,
            key_masked TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            secret_stored BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `;
        
        try {
          // Using Deno's Postgres client as a fallback
          const pgConnection = Deno.env.get('SUPABASE_DB_URL');
          
          if (!pgConnection) {
            throw new Error("Cannot access database directly - missing connection string");
          }
          
          // Import Postgres client dynamically
          const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
          
          const pool = new Pool(pgConnection, 1, true);
          const connection = await pool.connect();
          
          try {
            await connection.queryObject(createTableQuery);
            console.log("Table created successfully via Postgres client");
          } finally {
            connection.release();
            await pool.end();
          }
        } catch (pgError) {
          console.error("Error creating table:", pgError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `Failed to create api_keys table: ${pgError instanceof Error ? pgError.message : 'Unknown error'}`
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (tableError) {
      console.error("Error checking/creating table:", tableError);
    }
    
    // Generate a new UUID for the API key record
    const uuid = crypto.randomUUID();
    
    // Check if we need to deactivate other keys for the same service
    const singleKeyServices = ['openai', 'perplexity', 'fred'];
    if (singleKeyServices.includes(service.toLowerCase())) {
      try {
        const { error: updateError } = await supabase
          .from('api_keys')
          .update({ is_active: false })
          .eq('service', service)
          .eq('is_active', true);
          
        if (updateError) {
          console.error("Error deactivating existing keys:", updateError);
        }
      } catch (updateError) {
        console.log('No existing keys to deactivate or error:', updateError);
      }
    }
    
    // Store API key metadata in the database
    try {
      const { error: insertError } = await supabase
        .from('api_keys')
        .insert({
          id: uuid,
          name: name,
          service: service,
          key_masked: keyMasked,
          is_active: true,
          secret_stored: secretStored,
          created_at: new Date().toISOString()
        });
        
      if (insertError) {
        throw new Error(`Failed to store API key metadata: ${insertError.message}`);
      }
    } catch (insertError) {
      console.error("Error inserting key:", insertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Failed to store API key: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${service} API key stored successfully`,
        id: uuid,
        secret_stored: secretStored
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in set-api-key function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
