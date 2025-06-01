
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to log LLM usage to database
async function logLlmUsage(supabase: any, params: {
  model: string;
  usage?: any;
  status: string;
  error?: string;
  startTime: number;
  metadata?: any;
}) {
  try {
    const duration = Date.now() - params.startTime;
    const promptTokens = params.usage?.prompt_tokens || 0;
    const completionTokens = params.usage?.completion_tokens || 0;
    const totalTokens = params.usage?.total_tokens || 0;
    
    // Rough cost estimation for Perplexity API (approximate pricing)
    const estimatedCost = totalTokens * 0.001; // $1 per 1M tokens estimate
    
    await supabase.rpc('log_llm_usage', {
      p_function_name: 'magazine-research',
      p_model: params.model,
      p_prompt_tokens: promptTokens,
      p_completion_tokens: completionTokens,
      p_total_tokens: totalTokens,
      p_estimated_cost: estimatedCost,
      p_duration_ms: duration,
      p_status: params.status,
      p_error_message: params.error || null,
      p_operation_metadata: params.metadata || {}
    });
  } catch (logError) {
    console.error('Failed to log LLM usage:', logError);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Create a Supabase client with the Admin key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (!perplexityKey) {
      await logLlmUsage(supabase, {
        model: 'unknown',
        status: 'error',
        error: 'Perplexity API key not configured',
        startTime,
        metadata: { error_type: 'missing_api_key' }
      });
      
      return new Response(
        JSON.stringify({ error: 'Perplexity API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { 
      topic, 
      clusters = [], 
      keywords = [], 
      depth = "standard"
    } = await req.json();
    
    // Validate required params
    if (!topic) {
      await logLlmUsage(supabase, {
        model: 'unknown',
        status: 'error',
        error: 'Topic is required',
        startTime,
        metadata: { error_type: 'missing_topic' }
      });
      
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get relevant cluster keywords if clusters are provided
    let contextKeywords: string[] = [...keywords];
    
    if (clusters.length > 0) {
      const { data: clusterData, error: clusterError } = await supabase
        .from('keyword_clusters')
        .select('keywords')
        .in('id', clusters);
      
      if (clusterError) {
        console.error("Error fetching clusters:", clusterError);
      } else if (clusterData) {
        clusterData.forEach(cluster => {
          if (cluster.keywords) {
            contextKeywords = [...contextKeywords, ...cluster.keywords];
          }
        });
      }
    }
    
    // Remove duplicates from keywords
    contextKeywords = [...new Set(contextKeywords)];
    
    // Prepare research query
    const query = `Research topic: ${topic}
${contextKeywords.length > 0 ? `\nRelevant keywords: ${contextKeywords.join(', ')}` : ''}

Please provide a comprehensive research summary with the following:
1. Overview of current trends
2. Key statistics and data points
3. Expert perspectives
4. Competitor analysis
5. Future outlook`;

    console.log("Sending query to Perplexity:", query);

    // Select the appropriate Perplexity model based on depth
    let model = "llama-3.1-sonar-small-128k-online";
    if (depth === "deep") {
      model = "llama-3.1-sonar-large-128k-online";
    }

    // Call Perplexity API with logging
    try {
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: "You are a specialized mortgage industry researcher. Provide well-structured, fact-based research for financial publications. Include specific data points, statistics, and expert perspectives when available."
            },
            {
              role: "user",
              content: query
            }
          ],
          temperature: 0.3,
          max_tokens: 2048,
          return_related_questions: true,
          search_domain_filter: ["perplexity.ai", "wsj.com", "bloomberg.com", "mortgagenewsdaily.com"],
          search_recency_filter: "month"
        })
      });

      if (!perplexityResponse.ok) {
        const errorText = await perplexityResponse.text();
        
        await logLlmUsage(supabase, {
          model,
          status: 'error',
          error: `Perplexity API error: ${perplexityResponse.status} - ${errorText}`,
          startTime,
          metadata: {
            topic,
            keywords: contextKeywords,
            depth,
            clusters_count: clusters.length
          }
        });
        
        throw new Error(`Perplexity API error: ${perplexityResponse.status} - ${errorText}`);
      }
      
      const perplexityData = await perplexityResponse.json();
      
      // Log successful API call
      await logLlmUsage(supabase, {
        model: perplexityData.model || model,
        usage: perplexityData.usage,
        status: 'success',
        startTime,
        metadata: {
          topic,
          keywords: contextKeywords,
          keywords_count: contextKeywords.length,
          depth,
          clusters_count: clusters.length,
          response_length: perplexityData.choices[0].message.content.length,
          related_questions_count: perplexityData.choices[0].message.related_questions?.length || 0
        }
      });
      
      // Extract the research results
      const researchResults = {
        topic: topic,
        research: perplexityData.choices[0].message.content,
        related_questions: perplexityData.choices[0].message.related_questions || [],
        keywords: contextKeywords,
        created_at: new Date().toISOString(),
        model_used: model
      };

      return new Response(
        JSON.stringify({ success: true, data: researchResults }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (apiError) {
      console.error('Perplexity API call failed:', apiError);
      
      await logLlmUsage(supabase, {
        model,
        status: 'error',
        error: apiError instanceof Error ? apiError.message : String(apiError),
        startTime,
        metadata: {
          topic,
          keywords: contextKeywords,
          depth,
          clusters_count: clusters.length,
          error_type: 'api_call_failed'
        }
      });
      
      throw apiError;
    }
    
  } catch (error) {
    console.error('Error in magazine-research function:', error);
    
    // Log general function error if we have supabase available
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await logLlmUsage(supabase, {
        model: 'unknown',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        startTime,
        metadata: {
          error_type: 'general_function_error'
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
