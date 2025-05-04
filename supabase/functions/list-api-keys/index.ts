
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Ensure the api_keys table exists before querying
    await ensureApiKeysTableExists(supabase);
    
    // Get API keys with proper sorting and error handling
    const { data: apiKeys, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });
        
    if (error) {
      throw error;
    }
      
    // Format the response to ensure consistent date format
    const formattedKeys = apiKeys?.map(key => ({
      ...key,
      created_at: key.created_at // Keep ISO string format
    })) || [];
    
    return new Response(
      JSON.stringify({ 
        success: true,
        keys: formattedKeys
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in list-api-keys function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        keys: []
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
      return { success: true, message: 'Table created successfully', keys: [] };
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
