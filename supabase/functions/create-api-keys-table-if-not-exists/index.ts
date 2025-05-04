
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
    
    // Check if the api_keys table exists
    const { data: tables, error: tablesError } = await supabase.rpc('get_tables');
    
    if (tablesError) {
      throw new Error(`Failed to check if table exists: ${tablesError.message}`);
    }
    
    const tableExists = tables.some((table: any) => table.table_name === 'api_keys');
    
    if (!tableExists) {
      // Create the api_keys table
      const { error: createError } = await supabase.rpc('create_api_keys_table');
      
      if (createError) {
        throw new Error(`Failed to create api_keys table: ${createError.message}`);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: tableExists ? 'Table already exists' : 'Table created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-api-keys-table-if-not-exists function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
