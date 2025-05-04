
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
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!perplexityKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Perplexity API key not found in environment variables',
          details: 'The key may not be set or may have been removed.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if the key starts with the expected prefix
    if (!perplexityKey.startsWith('pplx-')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'The stored Perplexity API key does not appear to be in the correct format',
          details: 'Perplexity API keys should start with "pplx-"'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Test the Perplexity API key with a simple query
    try {
      console.log('Testing Perplexity API connection...');
      
      const response = await fetch('https://api.perplexity.ai/news/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'mortgage rates current trends',
          max_results: 2,
          filter: {
            time_range: '1d', // Last day
            countries: ['us']
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;
        
        let errorMessage = `API error: ${response.status} ${response.statusText}`;
        let errorDetails = errorText;
        
        // Provide more specific error messages based on status codes
        if (statusCode === 401) {
          errorMessage = 'Authentication failed: Invalid API key';
          errorDetails = 'The API key appears to be invalid or has been revoked. Please check your key and try again.';
        } else if (statusCode === 403) {
          errorMessage = 'Access forbidden: Insufficient permissions';
          errorDetails = 'Your API key does not have permission to access this resource.';
        } else if (statusCode === 429) {
          errorMessage = 'Rate limit exceeded';
          errorDetails = 'You have made too many requests. Please wait and try again later.';
        }
        
        throw new Error(errorMessage + ' - ' + errorDetails);
      }
      
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Perplexity API key is valid, but no results were found for the query',
            details: 'The API connection is working correctly, but no matching news articles were found.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Perplexity API key is valid',
          sample_result: `Found ${data.results.length} articles. Example: "${data.results[0].title}"`,
          details: `Connection successful. ${data.results.length} relevant mortgage news articles were found in the last 24 hours.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (apiError) {
      console.error('Error testing Perplexity API:', apiError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error connecting to Perplexity API',
          details: apiError instanceof Error ? apiError.message : 'Unknown API error occurred'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in test-perplexity-key function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'An unexpected error occurred while testing the API key',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
