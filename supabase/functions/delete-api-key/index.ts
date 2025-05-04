
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
    const { id } = await req.json();
    
    if (!id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing required field: id'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the key info first to determine the service
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('service')
      .eq('id', id)
      .single();
      
    if (keyError) {
      throw new Error(`Failed to fetch API key data: ${keyError.message}`);
    }
    
    if (!keyData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'API key not found'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // For Perplexity, clear the secret as well
    if (keyData.service.toLowerCase() === 'perplexity') {
      // We can't actually delete secrets via the API, but we can set it to an empty value
      const secretsResponse = await fetch(`${supabaseUrl}/functions/v1/secret`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'PERPLEXITY_API_KEY',
          value: '', // Empty value
        }),
      });
      
      if (!secretsResponse.ok) {
        console.error(`Failed to clear API key secret: ${await secretsResponse.text()}`);
        // Continue anyway to remove the metadata
      }
    }
    
    // Delete the API key metadata
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id);
      
    if (error) {
      throw new Error(`Failed to delete API key: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'API key deleted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-api-key function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
