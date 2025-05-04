
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Set the API key as a project secret
    // This is using the Supabase dashboard API, which requires admin privileges
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    // Generate a masked version of the API key for display
    const keyMasked = key.substring(0, 3) + '...' + key.substring(key.length - 4);
    
    // Store API key in the Supabase project secrets
    // For Perplexity API, store it as PERPLEXITY_API_KEY
    if (service.toLowerCase() === 'perplexity') {
      // Set the Edge Function secret
      const secretsResponse = await fetch(`${supabaseUrl}/functions/v1/secret`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'PERPLEXITY_API_KEY',
          value: key,
        }),
      });
      
      if (!secretsResponse.ok) {
        throw new Error(`Failed to store API key as a secret: ${await secretsResponse.text()}`);
      }
    }
    
    // Also store metadata about the key in the database for management purposes
    // Generate a new UUID for the API key record
    const uuid = crypto.randomUUID();
    
    // Store API key metadata in a "api_keys" table
    const createTableResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/create_api_keys_table_if_not_exists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!createTableResponse.ok) {
      console.error(`Failed to create api_keys table if needed: ${await createTableResponse.text()}`);
      // We'll continue anyway as the table might already exist
    }
    
    const storeResponse = await fetch(`${supabaseUrl}/rest/v1/api_keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        id: uuid,
        name: name,
        service: service,
        key_masked: keyMasked,
        is_active: true,
        created_at: new Date().toISOString(),
      }),
    });
    
    if (!storeResponse.ok) {
      throw new Error(`Failed to store API key metadata: ${await storeResponse.text()}`);
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
