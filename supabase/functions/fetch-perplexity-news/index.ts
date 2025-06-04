
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

interface NewsArticle {
  title: string;
  url: string;
  source?: string;
  summary?: string;
  relevance_score?: number;
  matched_clusters?: string[];
  is_competitor_covered?: boolean;
}

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
      p_function_name: 'fetch-perplexity-news',
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    if (!perplexityKey) {
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
    const modelOverride = requestData.modelOverride;
    
    // Validate keywords
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
    let model = modelOverride || "llama-3.1-sonar-small-128k-online";
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
        prompt = getDefaultJsonPrompt(keywords);
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
        
        prompt = promptData.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '');
        
        if (!prompt.includes("RESPONSE FORMAT: JSON") && !prompt.includes("format JSON")) {
          prompt = addJsonFormatInstructions(prompt);
        }
        
        if (promptData.model) {
          if (promptData.model === "perplexity/sonar-medium-online" || 
              promptData.model === "sonar-medium-online") {
            model = "llama-3.1-sonar-small-128k-online";
          } else if (promptData.model === "perplexity/sonar-small-online" || 
                    promptData.model === "sonar-small-online") {
            model = "llama-3.1-sonar-small-128k-online";
          } else if (promptData.model.startsWith("llama-3.1")) {
            model = promptData.model;
          } else {
            model = "llama-3.1-sonar-small-128k-online";
          }
        }
        
        includeClusterContext = promptData.include_clusters;
        includeTrackingSummary = promptData.include_tracking_summary;
        includeSourcesMap = promptData.include_sources_map;
      }
    } else {
      prompt = getDefaultJsonPrompt(keywords);
    }
    
    // Build context object for additional information
    let context = {};
    
    if (includeClusterContext) {
      const { data: clusters, error } = await supabase
        .from('keyword_clusters')
        .select('*');
        
      if (!error && clusters) {
        context = {
          ...context,
          keyword_clusters: clusters
        };
        
        if (prompt.includes("Topical Relevance") && clusters.length > 0) {
          console.log("Using structured prompt with embedded cluster data");
        } else if (searchSettings.selected_themes) {
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
      const keywordStr = keywords.length === 1 
        ? keywords[0] 
        : keywords.map((k: string, i: number) => `${i+1}. ${k}`).join('\n');
      
      if (prompt.includes("SEARCH & FILTER RULES:")) {
        console.log("Using structured prompt format with keywords:", keywords);
      } else {
        prompt += `\n\nKEYWORDS: ${keywordStr}`;
      }
    } else {
      prompt = prompt.replace("[QUERY]", keywords.join(", "));
    }
    
    console.log("Using model:", model);
    console.log("Search settings:", JSON.stringify(searchSettings));
    
    const apiPayload: any = {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant that helps find relevant news articles. You MUST return responses in JSON format with a specific structure following the "articles" array format requested by the user. Never include markdown formatting or explanatory text outside the JSON structure.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: searchSettings.temperature || 0.2,
      top_p: 0.9,
      max_tokens: searchSettings.max_tokens || 1000,
      frequency_penalty: 1,
      presence_penalty: 0
    };
    
    if (searchSettings.recency_filter) {
      const recencyValue = searchSettings.recency_filter === "48h" ? "day" : 
                           searchSettings.recency_filter === "24h" ? "day" : 
                           searchSettings.recency_filter;
      apiPayload.search_recency_filter = 
        ["hour", "day", "week", "month", "year"].includes(recencyValue) ? 
        recencyValue : "day";
    } else {
      apiPayload.search_recency_filter = "day";
    }
    
    if (searchSettings.domain_filter && searchSettings.domain_filter !== "auto") {
      apiPayload.search_domain_filter = searchSettings.domain_filter;
    }

    // Call Perplexity API with logging
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorResponse = await response.text();
        console.error("Perplexity API error:", errorResponse);
        
        // Log the failed API call
        await logLlmUsage(supabase, {
          model,
          status: 'error',
          error: `Perplexity API error (${response.status}): ${errorResponse}`,
          startTime,
          metadata: {
            keywords,
            prompt_length: prompt.length,
            api_payload: apiPayload
          }
        });
        
        throw new Error(`Perplexity API error (${response.status}): ${errorResponse}`);
      }

      const data: ChatCompletionResponse = await response.json();
      const result = data.choices[0].message.content;
      
      // Log successful API call
      await logLlmUsage(supabase, {
        model: data.model || model,
        usage: data.usage,
        status: 'success',
        startTime,
        metadata: {
          keywords,
          prompt_length: prompt.length,
          response_length: result.length,
          articles_requested: limit,
          min_score: minScore
        }
      });
      
      console.log("Raw response:", result);
      
      let articles = extractAndParseArticles(result);
      
      if (minScore > 0 && Array.isArray(articles)) {
        articles = articles.filter(a => 
          !a.relevance_score || a.relevance_score >= minScore
        );
      }
      
      if (limit > 0 && Array.isArray(articles) && articles.length > limit) {
        articles = articles.slice(0, limit);
      }

      let formattedArticles: NewsArticle[] = [];
      
      if (Array.isArray(articles)) {
        formattedArticles = articles.map(normalizeArticle);
      } else {
        console.error("Failed to extract articles array from response");
        formattedArticles = generateFallbackArticles("Failed to parse API response to valid JSON format");
      }
      
      if (formattedArticles.length === 0) {
        formattedArticles = generateFallbackArticles("No relevant news articles found");
        console.log("No articles found in search response. Raw response:", result);
      }
      
      return new Response(JSON.stringify({
        articles: formattedArticles,
        model: data.model,
        usage: data.usage,
        keywords: keywords,
        debug: {
          rawResponseLength: result.length,
          rawResponseSnippet: result.substring(0, 200) + "...",
          parsingMethod: Array.isArray(articles) ? "success" : "fallback"
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (apiError) {
      console.error("Perplexity API call failed:", apiError);
      
      // Log the failed API call
      await logLlmUsage(supabase, {
        model,
        status: 'error',
        error: apiError instanceof Error ? apiError.message : String(apiError),
        startTime,
        metadata: {
          keywords,
          prompt_length: prompt.length
        }
      });
      
      return new Response(JSON.stringify({
        articles: generateFallbackArticles(`Failed to retrieve articles: ${apiError instanceof Error ? apiError.message : String(apiError)}`),
        error: apiError instanceof Error ? apiError.message : String(apiError),
        keywords: keywords
      }), {
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error("Error in fetch-perplexity-news:", error);
    
    // Log the general error
    await logLlmUsage(supabase, {
      model: 'unknown',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      startTime,
      metadata: {
        error_type: 'general_function_error'
      }
    });
    
    return new Response(JSON.stringify({ 
      articles: generateFallbackArticles(`An error occurred while processing the request: ${error instanceof Error ? error.message : 'Unknown error'}`),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : null
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

// Helper functions for response formatting and parsing

function getDefaultJsonPrompt(keywords: string[]): string {
  return `Search for the latest news and developments related to the following topics in the mortgage and housing industry: ${keywords.join(", ")}

RESPONSE FORMAT: JSON
You MUST return your response as a properly formatted JSON object. No other text, explanation, or markdown formatting should be included.
The response should match this schema exactly:

{
  "articles": [
    {
      "title": "Article title",
      "url": "https://article-url.com",
      "source": "Source name",
      "summary": "A brief summary of the article",
      "relevance_score": 0.95,
      "matched_clusters": ["Cluster 1", "Cluster 2"],
      "is_competitor_covered": false
    }
  ]
}

The "articles" array must contain between 1 and 10 items. Each article must have all fields specified above.
The relevance_score should be between 0 and 1.0.`;
}

function addJsonFormatInstructions(prompt: string): string {
  const jsonInstructions = `\n\nRESPONSE FORMAT: JSON
You MUST return your response as a properly formatted JSON object. No other text, explanation, or markdown formatting should be included.
The response should match this schema exactly:

{
  "articles": [
    {
      "title": "Article title",
      "url": "https://article-url.com",
      "source": "Source name",
      "summary": "A brief summary of the article",
      "relevance_score": 0.95,
      "matched_clusters": ["Cluster 1", "Cluster 2"],
      "is_competitor_covered": false
    }
  ]
}`;

  return prompt + jsonInstructions;
}

function extractAndParseArticles(response: string): any[] {
  try {
    // Try different methods to extract JSON from the response
    
    // Method 1: Direct JSON parsing (if response is clean JSON)
    try {
      const parsed = JSON.parse(response);
      if (parsed && Array.isArray(parsed.articles)) {
        return parsed.articles;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Not valid JSON, continue to other methods
    }
    
    const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      try {
        const parsedBlock = JSON.parse(jsonBlockMatch[1]);
        if (parsedBlock && Array.isArray(parsedBlock.articles)) {
          return parsedBlock.articles;
        }
        if (Array.isArray(parsedBlock)) {
          return parsedBlock;
        }
      } catch (e) {
        // Invalid JSON in code block, continue to next method
      }
    }
    
    const jsonObjectMatch = response.match(/(\{[\s\S]*\})/);
    if (jsonObjectMatch) {
      try {
        const parsedObject = JSON.parse(jsonObjectMatch[1]);
        if (parsedObject && Array.isArray(parsedObject.articles)) {
          return parsedObject.articles;
        }
      } catch (e) {
        // Invalid JSON object, continue to next method
      }
    }
    
    if (response.includes('##') || response.includes('**Title:')) {
      const articles = extractArticlesFromMarkdown(response);
      if (articles.length > 0) {
        return articles;
      }
    }
    
    return [];
  } catch (e) {
    console.error("Error extracting articles:", e);
    return [];
  }
}

function extractArticlesFromMarkdown(markdown: string): any[] {
  const articles = [];
  
  const sections = markdown.split(/(?:^|\n)(?:##|\*\*|-)(?=[^#\*\n])/gm);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    const titleMatch = section.match(/(?:Title:|[A-Z][\w\s]+:)\s*(.*?)(?:\n|$)/i);
    const urlMatch = section.match(/(?:URL:|Link:|https?:\/\/)[^\s\n]+(\/[^\s\n]*)?/i);
    const summaryMatch = section.match(/(?:Summary:|Description:)\s*([\s\S]*?)(?:\n\n|\n(?:[A-Z][\w\s]+:)|\n-|\n\*\*|$)/i);
    const sourceMatch = section.match(/(?:Source:)\s*(.*?)(?:\n|$)/i);
    
    if (titleMatch || urlMatch) {
      const article = {
        title: titleMatch ? titleMatch[1].trim() : "Unknown Title",
        url: urlMatch ? urlMatch[0].replace(/(?:URL:|Link:)\s*/i, '').trim() : "https://example.com",
        summary: summaryMatch ? summaryMatch[1].trim() : "",
        source: sourceMatch ? sourceMatch[1].trim() : new URL(urlMatch ? urlMatch[0] : "https://example.com").hostname.replace('www.', ''),
        relevance_score: 0.7,
        matched_clusters: [],
        is_competitor_covered: false
      };
      
      articles.push(article);
    }
  }
  
  return articles;
}

function normalizeArticle(article: any): NewsArticle {
  return {
    title: article.title || article.headline || "Untitled Article", // Ensure we use title consistently
    url: article.url || "#",
    source: article.source || (article.url ? new URL(article.url).hostname.replace('www.', '') : "Unknown Source"),
    summary: article.summary || article.description || "",
    relevance_score: article.relevance_score || article.score || 0.7,
    matched_clusters: Array.isArray(article.matched_clusters) ? article.matched_clusters : 
                     Array.isArray(article.clusters) ? article.clusters : [],
    is_competitor_covered: Boolean(article.is_competitor_covered)
  };
}

function generateFallbackArticles(message: string): NewsArticle[] {
  return [{
    title: "News Import Information",
    url: "#",
    source: "System",
    summary: message,
    relevance_score: 1.0,
    matched_clusters: [],
    is_competitor_covered: false
  }];
}
