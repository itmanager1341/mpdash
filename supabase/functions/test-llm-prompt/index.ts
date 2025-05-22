
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
    if (!prompt_text || !model) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: prompt_text or model" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If no input data provided for testing, create sample data for news search
    const testData = input_data || {
      search_query: "mortgage rates",
      date_range: "last 24 hours" 
    };

    const startTime = Date.now();
    
    // Get additional context data if required
    let contextData = {};
    
    if (include_clusters) {
      // In a real implementation, fetch cluster data from database
      contextData = {
        ...contextData,
        clusters: [
          { theme: "Core Mortgage Industry", keywords: ["mortgage rates", "refinance", "HELOC", "non-QM", "underwriting"] },
          { theme: "Mortgage Servicing & Loss Mitigation", keywords: ["MSRs", "servicing transfers", "forbearance", "REO", "loss mitigation"] },
          { theme: "Policy & Regulation", keywords: ["CFPB", "HUD", "TRID", "Dodd-Frank", "fair lending"] },
          { theme: "Market & Risk Indicators", keywords: ["affordability", "home prices", "delinquency", "housing supply", "foreclosure"] },
          { theme: "Macro & Fed Policy", keywords: ["Fed", "bond yields", "inflation", "MBS", "securitization"] }
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
          tier1: ["FHFA", "HUD", "Fannie Mae", "Freddie Mac"],
          tier2: ["MBA", "NAR", "Urban Institute"],
          tier3: ["WSJ", "Bloomberg", "CNBC"]
        }
      };
    }

    // Process the template with input data
    let processedPrompt = prompt_text;
    
    // Simple variable replacement
    if (typeof testData === 'object') {
      Object.entries(testData).forEach(([key, value]) => {
        processedPrompt = processedPrompt.replace(
          new RegExp(`{${key}}`, 'g'), 
          String(value)
        );
      });
    }

    // Special case for news search prompts
    const isNewsSearchPrompt = model.includes('sonar') || 
                              model.includes('perplexity') || 
                              model.includes('online') || 
                              processedPrompt.includes('Search & Filter Rules') ||
                              processedPrompt.includes('search for news');
                              
    // Prepare sample API response for news search
    const sampleNewsArticles = [
      {
        title: "Federal Reserve Signals Potential Rate Cut as Mortgage Rates Stabilize",
        url: "https://example.com/fed-signals-rate-cut",
        cluster: "Macro & Fed Policy",
        summary: "The Federal Reserve's latest meeting minutes indicate a potential rate cut in September, which could provide relief to homebuyers facing elevated mortgage rates.",
        source: "Economic Org",
        published: "2025-05-21T14:32:00Z"
      },
      {
        title: "FHFA Announces New Affordable Housing Goals for 2026",
        url: "https://example.com/fhfa-housing-goals",
        cluster: "Policy & Regulation",
        summary: "The Federal Housing Finance Agency set ambitious new targets for Fannie Mae and Freddie Mac to increase support for underserved markets, effective January 2026.",
        source: "Government",
        published: "2025-05-20T09:15:00Z"
      },
      {
        title: "Housing Inventory Reaches 5-Year High as Market Shifts",
        url: "https://example.com/housing-inventory-high",
        cluster: "Market & Risk Indicators",
        summary: "The supply of homes for sale hit a 5-year high last month, potentially easing price pressures and creating more opportunities for first-time homebuyers.",
        source: "Media",
        published: "2025-05-22T11:45:00Z"
      }
    ];
    
    // Format as a news search response if it's a news search prompt
    const newsSearchResponse = {
      articles: sampleNewsArticles,
      search_query: testData.search_query,
      date_range: testData.date_range,
      explanation: "This is a test response showing how your prompt would return structured news articles. In production, the LLM would search the latest news sources based on your configured parameters."
    };

    let result = "";
    if (isNewsSearchPrompt) {
      result = JSON.stringify(newsSearchResponse, null, 2);
    } else {
      // For non-news prompts, simulate a more generic LLM response
      result = `This is a simulated response to your prompt. In production, this would be generated by the ${model} model.
      
The prompt used was:

${processedPrompt.substring(0, 200)}... (truncated)

In a real environment, this would connect to the selected model's API and return actual results.
For news search prompts, you would get real articles matching your search criteria.
For other prompt types, you would get the model's response to your instructions.`;
    }

    const endTime = Date.now();
    
    // Simulate model raw response
    const rawResponse = {
      id: "test-response-12345",
      model: model,
      choices: [
        {
          message: {
            role: "assistant",
            content: result
          },
          finish_reason: "stop",
          index: 0
        }
      ],
      usage: {
        prompt_tokens: processedPrompt.length / 4, // Very rough approximation
        completion_tokens: result.length / 4,      // Very rough approximation
        total_tokens: (processedPrompt.length + result.length) / 4
      }
    };

    return new Response(
      JSON.stringify({
        output: result,
        raw_response: rawResponse,
        timing: {
          total_ms: endTime - startTime,
          prompt_tokens: rawResponse.usage?.prompt_tokens,
          completion_tokens: rawResponse.usage?.completion_tokens,
        },
        model_used: model,
        test_details: {
          is_news_search: isNewsSearchPrompt,
          test_query: testData.search_query || "No query provided",
          simulation_note: "This is a simulated test response showing how your prompt would behave in production. The sample articles match your configured cluster keywords and source priorities."
        }
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
