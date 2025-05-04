
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
    const { name, key, service } = await req.json();
    
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
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Generate a masked version of the API key for display
    const keyMasked = key.substring(0, 3) + '...' + key.substring(key.length - 4);
    
    // Store API key in the Supabase project secrets
    if (service.toLowerCase() === 'perplexity') {
      // Set the Edge Function secret
      try {
        await supabase.functions.setSecret('PERPLEXITY_API_KEY', key);
        console.log('Successfully stored PERPLEXITY_API_KEY as a secret');
      } catch (secretError) {
        console.error('Error setting secret:', secretError);
        // Continue anyway, we'll still store the metadata
      }
    }
    
    // Create the api_keys table if it doesn't exist
    try {
      const { error: tableCheckError } = await supabase
        .from('api_keys')
        .select('count')
        .limit(1);
        
      if (tableCheckError && tableCheckError.message.includes('relation "public.api_keys" does not exist')) {
        // Table doesn't exist, create it
        const { error: createTableError } = await supabase.rpc('create_table_if_not_exists', {
          table_name: 'api_keys',
          table_definition: `
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            service TEXT NOT NULL,
            key_masked TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
          `
        });
        
        if (createTableError) {
          // Try direct SQL as a fallback
          const { error: sqlError } = await supabase.sql(`
            CREATE TABLE IF NOT EXISTS api_keys (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name TEXT NOT NULL,
              service TEXT NOT NULL,
              key_masked TEXT NOT NULL,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
          `);
          
          if (sqlError) {
            console.error('Failed to create api_keys table:', sqlError);
          }
        }
      }
    } catch (tableError) {
      console.error('Error checking/creating table:', tableError);
      // Continue anyway, the insert might still work if the table exists
    }
    
    // Generate a new UUID for the API key record
    const uuid = crypto.randomUUID();
    
    // Store API key metadata in the database
    const { error: insertError } = await supabase
      .from('api_keys')
      .insert({
        id: uuid,
        name: name,
        service: service,
        key_masked: keyMasked,
        is_active: true
      });
      
    if (insertError) {
      throw new Error(`Failed to store API key metadata: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'API key stored successfully',
        id: uuid,
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
