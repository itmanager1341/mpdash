
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!perplexityApiKey) {
      return new Response(JSON.stringify({ error: "Perplexity API key not configured" }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { keywords, promptId, minScore = 0.6, limit = 10 } = await req.json();
    
    // Validate required fields
    if (!keywords || (Array.isArray(keywords) && !keywords.length)) {
      return new Response(JSON.stringify({ error: "Keywords are required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let prompt: string;
    let model = "llama-3.1-sonar-large-128k-online";
    let searchSettings: any = {
      search_domain_filter: "auto",
      search_recency_filter: "day",
      temperature: 0.2,
      max_tokens: 1000
    };
    let includeClusterContext = false;
    let includeTrackingSummary = false;
    let includeSourcesMap = false;
    
    // If promptId is provided, get the custom prompt
    if (promptId) {
      const { data: promptData, error } = await supabase
        .from("llm_prompts")
        .select("*")
        .eq("id", promptId)
        .single();
        
      if (error || !promptData) {
        console.error("Error fetching prompt:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch prompt" }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Extract metadata if present
      const metadataMatch = promptData.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
      if (metadataMatch) {
        try {
          const metadata = JSON.parse(metadataMatch[1]);
          if (metadata.search_settings) {
            searchSettings = {
              ...searchSettings,
              ...metadata.search_settings
            };
          }
        } catch (e) {
          console.error("Error parsing metadata from prompt:", e);
        }
      }
      
      // Remove metadata from prompt text
      prompt = promptData.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '');
      model = promptData.model;
      includeClusterContext = promptData.include_clusters;
      includeTrackingSummary = promptData.include_tracking_summary;
      includeSourcesMap = promptData.include_sources_map;
    } else {
      // Default prompt
      prompt = `Search for the latest news and developments related to the following topic in the mortgage and housing industry:`;
    }
    
    // Prepare query string
    let queryStr: string;
    if (Array.isArray(keywords)) {
      queryStr = keywords.join(' ');
    } else {
      queryStr = keywords.toString();
    }
    
    // Build a context object for additional information
    let context = {};
    
    // Fetch keyword clusters if requested
    if (includeClusterContext) {
      const { data: clusters, error } = await supabase
        .from('keyword_clusters')
        .select('*');
        
      if (!error && clusters) {
        context = {
          ...context,
          keyword_clusters: clusters
        };
        
        // If the prompt is using the Visual Builder format, add cluster info
        if (searchSettings.selected_themes) {
          // Filter clusters based on selected themes
          const relevantClusters = clusters.filter((c: any) => 
            searchSettings.selected_themes.primary?.includes(c.primary_theme) || 
            searchSettings.selected_themes.sub?.includes(c.sub_theme)
          );
          
          if (relevantClusters.length > 0) {
            prompt += "\n\nRELEVANT KEYWORD CLUSTERS:";
            relevantClusters.forEach((cluster: any) => {
              prompt += `\n${cluster.primary_theme} > ${cluster.sub_theme}: ${(cluster.keywords || []).join(', ')}`;
            });
          }
        }
      }
    }
    
    // Fetch keyword tracking summary if requested
    if (includeTrackingSummary) {
      const { data: tracking, error } = await supabase
        .from('keyword_tracking')
        .select('*');
        
      if (!error && tracking) {
        context = {
          ...context,
          keyword_tracking: tracking
        };
      }
    }
    
    // Fetch sources map if requested
    if (includeSourcesMap) {
      const { data: sources, error } = await supabase
        .from('sources')
        .select('*');
        
      if (!error && sources) {
        context = {
          ...context,
          sources: sources
        };
      }
    }
    
    // Add topic to prompt if there's no [QUERY] placeholder
    // This handles both old style ([QUERY]) and new style (no placeholder) prompts
    if (!prompt.includes("[QUERY]")) {
      prompt += `\n\nTOPIC: ${queryStr}`;
    } else {
      prompt = prompt.replace("[QUERY]", queryStr);
    }
    
    console.log("Using model:", model);
    console.log("Search settings:", JSON.stringify(searchSettings));
    
    // Call Perplexity API
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant that helps find relevant news articles.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: searchSettings.temperature || 0.2,
        top_p: 0.9,
        max_tokens: searchSettings.max_tokens || 1000,
        search_domain_filter: searchSettings.domain_filter || "auto",
        search_recency_filter: searchSettings.recency_filter || "day",
        return_images: false,
        return_related_questions: false,
        frequency_penalty: 1,
        presence_penalty: 0
      }),
    });

    if (!response.ok) {
      const errorResponse = await response.text();
      console.error("Perplexity API error:", errorResponse);
      return new Response(JSON.stringify({ error: "Perplexity API error", details: errorResponse }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data: ChatCompletionResponse = await response.json();
    const result = data.choices[0].message.content;
    
    // Try to parse JSON from the response
    let articles = [];
    try {
      // First, look for a JSON block in the response
      const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/) || 
                        result.match(/\{[\s\S]*"articles"[\s\S]*\}/);
                        
      const jsonContent = jsonMatch ? jsonMatch[1] || jsonMatch[0] : result;
      const parsedData = JSON.parse(jsonContent);
      
      // Handle different formats (direct array or nested in articles property)
      articles = Array.isArray(parsedData) ? parsedData : 
                (parsedData.articles || parsedData.results || []);
                
      // Filter by minimum score if present
      if (minScore > 0) {
        articles = articles.filter(a => 
          !a.relevance_score || a.relevance_score >= minScore
        );
      }
      
      // Limit number of results
      if (limit > 0 && articles.length > limit) {
        articles = articles.slice(0, limit);
      }
    } catch (e) {
      console.error("Error parsing articles:", e);
      console.log("Raw response:", result);
      
      return new Response(JSON.stringify({ 
        error: "Failed to parse articles from response",
        raw_response: result
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      articles,
      model: data.model,
      usage: data.usage,
      queryStr,
      prompt: prompt
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error("Error in fetch-perplexity-news:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
