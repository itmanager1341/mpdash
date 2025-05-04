
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Check if api_keys table exists and create if it doesn't
    try {
      const { error: checkError } = await supabase
        .from('api_keys')
        .select('count')
        .limit(1);
        
      if (checkError && checkError.message.includes('relation "public.api_keys" does not exist')) {
        console.log("api_keys table does not exist, creating it...");
        
        // Create the table directly with SQL
        const { error: createTableError } = await supabase.rpc('create_table_if_not_exists', {
          table_name: 'api_keys',
          table_definition: `
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            service TEXT NOT NULL,
            key_masked TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          `
        });
        
        if (createTableError) {
          // If RPC fails, try direct SQL (requires more permissions)
          const { error: sqlError } = await supabase.sql(`
            CREATE TABLE IF NOT EXISTS public.api_keys (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name TEXT NOT NULL,
              service TEXT NOT NULL,
              key_masked TEXT NOT NULL,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
          `);
          
          if (sqlError) {
            throw new Error(`Failed to create api_keys table: ${sqlError.message}`);
          }
        }
        
        // Return empty keys array as the table was just created
        return new Response(
          JSON.stringify({ success: true, keys: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      throw new Error(`Failed to check or create api_keys table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Get all API keys
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      throw new Error(`Failed to fetch API keys: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        keys: keys || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in list-api-keys function:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
