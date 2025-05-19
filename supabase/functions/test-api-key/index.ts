
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
    const body = await req.json();
    const { service, key } = body;
    
    if (!service || !key) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing required parameters: service and key are required'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set up Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase URL or service role key");
    }
    
    let testResult = false;
    let testMessage = "API key test failed";
    
    // Test different service APIs
    switch (service.toLowerCase()) {
      case 'perplexity':
        const pplxUrl = "https://api.perplexity.ai/chat/completions";
        const pplxResponse = await fetch(pplxUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: "llama-3-sonar-small-32k",
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: "Hello, I'm testing my API key." }
            ],
            max_tokens: 50
          })
        });
        
        if (pplxResponse.ok) {
          testResult = true;
          testMessage = "Perplexity API key is valid";
        } else {
          const errorData = await pplxResponse.json().catch(() => ({}));
          testMessage = `Perplexity API key test failed: ${pplxResponse.status} ${pplxResponse.statusText}`;
          if (errorData.error) {
            testMessage += ` - ${errorData.error.message || JSON.stringify(errorData.error)}`;
          }
        }
        break;
        
      case 'openai':
        const openaiUrl = "https://api.openai.com/v1/chat/completions";
        const openaiResponse = await fetch(openaiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: "Hello, I'm testing my API key." }
            ],
            max_tokens: 50
          })
        });
        
        if (openaiResponse.ok) {
          testResult = true;
          testMessage = "OpenAI API key is valid";
        } else {
          const errorData = await openaiResponse.json().catch(() => ({}));
          testMessage = `OpenAI API key test failed: ${openaiResponse.status} ${openaiResponse.statusText}`;
          if (errorData.error) {
            testMessage += ` - ${errorData.error.message || JSON.stringify(errorData.error)}`;
          }
        }
        break;
        
      case 'fred':
        const fredUrl = `https://api.stlouisfed.org/fred/series?series_id=MORTGAGE30US&api_key=${key}&file_type=json`;
        const fredResponse = await fetch(fredUrl);
        
        if (fredResponse.ok) {
          testResult = true;
          testMessage = "FRED API key is valid";
        } else {
          const errorData = await fredResponse.json().catch(() => ({}));
          testMessage = `FRED API key test failed: ${fredResponse.status} ${fredResponse.statusText}`;
          if (errorData.error_message) {
            testMessage += ` - ${errorData.error_message}`;
          }
        }
        break;
        
      default:
        testMessage = `Testing for ${service} service is not implemented`;
    }

    return new Response(
      JSON.stringify({ 
        success: testResult, 
        message: testMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in test-api-key function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
