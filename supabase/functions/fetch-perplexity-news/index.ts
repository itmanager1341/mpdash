
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");

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
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase URL or service key configuration");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    if (!perplexityApiKey) {
      // Check if the API key is stored in the api_keys table instead
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('service', 'perplexity')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (apiKeyError || !apiKeyData) {
        return new Response(JSON.stringify({ 
          error: "Perplexity API key not found. Please add a valid API key in Admin Settings.",
          details: "Add a Perplexity API key through the API Keys tab in Admin Settings."
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // We can't access the actual key from here because it's stored as a secret
      return new Response(JSON.stringify({ 
        error: "Perplexity API key is configured but not accessible from this function",
        details: "The API key needs to be added as an Edge Function Secret with the name PERPLEXITY_API_KEY"
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request and set default values
    const requestData = await req.json();
    const keywords = requestData.keywords || ["mortgage rates", "housing market", "federal reserve"];
    const promptId = requestData.promptId;
    const minScore = requestData.minScore || 0.6;
    const limit = requestData.limit || 10;
    
    // Validate keywords - ensure we have at least one
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return new Response(JSON.stringify({ 
        error: "No valid search keywords provided",
        details: "Configure keywords in the Scheduled Tasks section"
      }), {
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
        // Fall back to default prompt
        prompt = `Search for the latest news and developments related to the following topics in the mortgage and housing industry: ${keywords.join(", ")}`;
      } else {
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
      }
    } else {
      // Default prompt
      prompt = `Search for the latest news and developments related to the following topics in the mortgage and housing industry: ${keywords.join(", ")}

Please return information in the following format for each article:
{
  "articles": [
    {
      "title": "Article title",
      "url": "https://article-url.com",
      "source": "Source name",
      "summary": "A brief summary of the article",
      "relevance_score": 0.95,
      "matched_clusters": ["Cluster 1", "Cluster 2"]
    }
  ]
}`;
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
        
        // If the prompt is using the structured format, add cluster info
        if (prompt.includes("Topical Relevance") && clusters.length > 0) {
          // The clusters are already in the prompt in the structured format
          console.log("Using structured prompt with embedded cluster data");
        } else if (searchSettings.selected_themes) {
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
    
    // Fetch additional context data if requested
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
    if (!prompt.includes("[QUERY]")) {
      // If using multiple keywords, create a formatted list
      const keywordStr = keywords.length === 1 
        ? keywords[0] 
        : keywords.map((k: string, i: number) => `${i+1}. ${k}`).join('\n');
      
      // Check if prompt is using the structured format
      if (prompt.includes("SEARCH & FILTER RULES:")) {
        // Already structured - keywords will be used for search
        console.log("Using structured prompt format with keywords:", keywords);
      } else {
        // Add keywords to standard prompt
        prompt += `\n\nKEYWORDS: ${keywordStr}`;
      }
    } else {
      // Replace [QUERY] with joined keywords
      prompt = prompt.replace("[QUERY]", keywords.join(", "));
    }
    
    console.log("Using model:", model);
    console.log("Search settings:", JSON.stringify(searchSettings));
    
    // Call Perplexity API
    try {
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
        throw new Error(`Perplexity API error (${response.status}): ${errorResponse}`);
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
        
        // Try to clean up the content before parsing - sometimes there's markdown or other text
        let cleanedContent = jsonContent;
        // Remove markdown code block markers if present but weren't matched above
        cleanedContent = cleanedContent.replace(/```json|```/g, '').trim();
        
        // Try to extract just a valid JSON object/array
        const jsonObjectMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          cleanedContent = jsonObjectMatch[0];
        }
        
        const parsedData = JSON.parse(cleanedContent);
        
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

        // Enhanced fields for structured prompts
        articles = articles.map(article => {
          // Ensure each article has a matched_clusters field if it has a cluster field
          if (article.cluster && !article.matched_clusters) {
            article.matched_clusters = [article.cluster];
          }
          
          // Ensure each article has a relevance_score
          if (!article.relevance_score) {
            article.relevance_score = 1.0;
          }
          
          return article;
        });
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
      
      // If we got no articles but the call was successful, add a placeholder with debugging info
      if (articles.length === 0) {
        articles = [{
          title: "No relevant news articles found",
          url: "https://perplexity.ai",
          source: "Perplexity",
          summary: "The search found no relevant articles matching your criteria. Try adjusting your keywords or search settings.",
          relevance_score: 1.0,
          matched_clusters: []
        }];
        
        // Log this for debugging
        console.log("No articles found in search response. Raw response:", result);
      }
      
      return new Response(JSON.stringify({
        articles,
        model: data.model,
        usage: data.usage,
        keywords: keywords,
        prompt: prompt
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (apiError) {
      console.error("Perplexity API call failed:", apiError);
      throw new Error(`Perplexity API call failed: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
    }
    
  } catch (error) {
    console.error("Error in fetch-perplexity-news:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : null
    }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
