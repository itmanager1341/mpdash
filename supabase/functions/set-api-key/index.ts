
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
    // Improved masking for security while maintaining identifiability
    const firstChars = key.substring(0, 3);
    const lastChars = key.substring(key.length - 4);
    const maskedLength = Math.min(key.length - 7, 10);
    const keyMasked = `${firstChars}${'•'.repeat(maskedLength)}${lastChars}`;
    
    // Store API key in the Supabase project secrets based on service type
    let secretName = '';
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
      
      // Only set if we have a valid secret name
      if (secretName) {
        console.log(`Storing ${secretName} in Edge Function secrets`);
        await supabase.functions.setSecret(secretName, key);
        console.log(`Successfully stored ${secretName} as a secret`);
      }
    } catch (secretError) {
      console.error('Error setting secret:', secretError);
      // Continue anyway to store metadata, but include a warning in the response
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'API key metadata stored but secret storage failed',
          warning: 'The API key was stored in the database, but setting the Edge Function secret failed. Some functionality may not work correctly.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Ensure the api_keys table exists
    await ensureApiKeysTableExists(supabase);
    
    // Generate a new UUID for the API key record
    const uuid = crypto.randomUUID();
    
    // Check if we need to deactivate other keys for the same service
    // For services like OpenAI where we typically want only one active key
    const singleKeyServices = ['openai', 'perplexity', 'fred'];
    if (singleKeyServices.includes(service.toLowerCase())) {
      try {
        await supabase
          .from('api_keys')
          .update({ is_active: false })
          .eq('service', service)
          .eq('is_active', true);
      } catch (updateError) {
        console.log('No existing keys to deactivate or error:', updateError);
        // Continue with insertion
      }
    }
    
    // Store API key metadata in the database
    const { error: insertError } = await supabase
      .from('api_keys')
      .insert({
        id: uuid,
        name: name,
        service: service,
        key_masked: keyMasked,
        is_active: true,
        created_at: new Date().toISOString()
      });
      
    if (insertError) {
      throw new Error(`Failed to store API key metadata: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${service} API key stored successfully`,
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

// Helper function to ensure the api_keys table exists
async function ensureApiKeysTableExists(supabase) {
  try {
    // Try to query the table first to see if it exists
    const { error: queryError } = await supabase
      .from('api_keys')
      .select('count')
      .limit(1);
      
    if (queryError && queryError.message.includes('relation "public.api_keys" does not exist')) {
      console.log('api_keys table does not exist, creating it...');
      
      // Table doesn't exist, create it
      const { error: createError } = await supabase.sql(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          service TEXT NOT NULL,
          key_masked TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      
      if (createError) {
        throw new Error(`Failed to create api_keys table: ${createError.message}`);
      }
      
      console.log('api_keys table created successfully');
    } else if (queryError) {
      throw new Error(`Error checking if api_keys table exists: ${queryError.message}`);
    } else {
      console.log('api_keys table already exists');
    }
  } catch (error) {
    console.error('Error in ensureApiKeysTableExists:', error);
    throw error;
  }
}
