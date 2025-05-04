
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
    
    console.log("Creating api_keys table if it doesn't exist");
    
    // First check if the table exists
    const { error: checkError } = await supabase
      .from('api_keys')
      .select('count')
      .limit(1)
      .single();
      
    if (checkError && checkError.message.includes('relation "public.api_keys" does not exist')) {
      console.log("Table doesn't exist, creating it now");
      
      // Use raw RPC to execute SQL (alternative to direct SQL)
      const { error: createError } = await supabase.rpc('create_api_keys_table');
      
      if (createError) {
        throw new Error(`Failed to create table via RPC: ${createError.message}`);
      }
      
      console.log("Successfully created api_keys table");
    } else if (checkError) {
      console.error("Error checking if table exists:", checkError);
    } else {
      console.log("api_keys table already exists");
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: "API keys table initialization completed"
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error("Error creating api_keys table:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
