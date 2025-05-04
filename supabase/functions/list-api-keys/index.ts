
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
    
    // First check if the table exists
    const { error: checkError } = await supabase
      .from('api_keys')
      .select('count')
      .limit(1);
      
    if (checkError && checkError.message.includes('relation "public.api_keys" does not exist')) {
      console.log("api_keys table does not exist, creating it...");
      
      // Call the create_api_keys_table function
      const { error: createError } = await supabase.rpc('create_api_keys_table');
      
      if (createError) {
        throw new Error(`Failed to create api_keys table via RPC: ${createError.message}`);
      }
    } else if (checkError) {
      console.error("Error checking if api_keys table exists:", checkError);
    }
    
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
