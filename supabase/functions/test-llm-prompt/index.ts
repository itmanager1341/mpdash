
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configure API keys from environment variables
const openAIKey = Deno.env.get('OPENAI_API_KEY');
const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
// Add other API keys as needed

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const { 
      prompt_text, 
      model, 
      input_data, 
      include_clusters, 
      include_tracking_summary, 
      include_sources_map 
    } = requestData;

    // Validate required fields
    if (!prompt_text || !model || !input_data) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: prompt_text, model, or input_data" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const startTime = Date.now();
    
    // Get additional context data if required
    let contextData = {};
    
    if (include_clusters) {
      // In a real implementation, fetch cluster data from database
      contextData = {
        ...contextData,
        clusters: [
          { theme: "Mortgage Rates", keywords: ["interest rates", "APR", "fixed rate"] },
          { theme: "Housing Market", keywords: ["home prices", "inventory", "sales"] }
        ]
      };
    }
    
    if (include_tracking_summary) {
      // In a real implementation, fetch tracking data from database
      contextData = {
        ...contextData,
        tracking: {
          top_keywords: ["mortgage rates", "housing market", "fed meeting"],
          trending: ["refinancing", "first-time homebuyers"]
        }
      };
    }
    
    if (include_sources_map) {
      // In a real implementation, fetch sources data from database
      contextData = {
        ...contextData,
        sources: {
          tier1: ["Wall Street Journal", "Bloomberg", "CNBC"],
          tier2: ["HousingWire", "Mortgage News Daily"],
          tier3: ["Local news outlets", "Blogs"]
        }
      };
    }

    // Process the template with input data
    let processedPrompt = prompt_text;
    
    // Simple variable replacement
    if (typeof input_data === 'object') {
      Object.entries(input_data).forEach(([key, value]) => {
        processedPrompt = processedPrompt.replace(
          new RegExp(`{${key}}`, 'g'), 
          String(value)
        );
      });
    }

    // Handle different LLM APIs based on model
    let result;
    let rawResponse;
    
    if (model.startsWith('gpt')) {
      // OpenAI GPT models
      if (!openAIKey) {
        return new Response(
          JSON.stringify({ error: "OpenAI API key is not configured" }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: `You are a helpful editorial AI assistant for MortgagePoint. ${
                Object.keys(contextData).length > 0 
                  ? `\nContext: ${JSON.stringify(contextData)}` 
                  : ''
              }`
            },
            { role: 'user', content: processedPrompt }
          ],
          temperature: 0.7,
        }),
      });
      
      rawResponse = await response.json();
      result = rawResponse.choices[0].message.content;
      
    } else if (model.startsWith('claude')) {
      // Anthropic Claude models (placeholder)
      result = "Claude API integration would process the prompt here";
      rawResponse = { message: "Claude API mock response" };
      
    } else if (model === 'perplexity') {
      // Perplexity API
      if (!perplexityKey) {
        return new Response(
          JSON.stringify({ error: "Perplexity API key is not configured" }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      result = "Perplexity API integration would process the prompt here";
      rawResponse = { message: "Perplexity API mock response" };
      
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported model: ${model}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const endTime = Date.now();
    
    // Try to parse the result as JSON, but if it's not valid JSON
    // just return it as plain text
    let parsedOutput;
    try {
      parsedOutput = JSON.parse(result);
    } catch (e) {
      parsedOutput = result;
    }

    return new Response(
      JSON.stringify({
        output: parsedOutput,
        raw_response: rawResponse,
        timing: {
          total_ms: endTime - startTime,
          prompt_tokens: rawResponse.usage?.prompt_tokens,
          completion_tokens: rawResponse.usage?.completion_tokens,
        },
        model_used: model,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in test-llm-prompt function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
