
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
    
    // Check if the api_keys table exists using a more reliable method
    try {
      // First try to query the table directly - if it doesn't exist, this will fail
      const { data: apiKeys, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        // If there's an error and it's about the table not existing
        if (error.message.includes('relation "public.api_keys" does not exist')) {
          // Return empty array since table doesn't exist yet
          return new Response(
            JSON.stringify({ keys: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw error; // Re-throw if it's another kind of error
      }
      
      // If we get here, the table exists and we have data
      return new Response(
        JSON.stringify({ keys: apiKeys || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (tableError) {
      console.log("Error checking/querying api_keys table:", tableError);
      // Return empty array as a fallback
      return new Response(
        JSON.stringify({ keys: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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
