
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    const { source, context } = await req.json();
    
    // Get API keys from environment variables
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!perplexityKey && !openAIKey) {
      throw new Error("Either Perplexity or OpenAI API key is required");
    }
    
    // Determine which API to use based on available keys
    const apiToUse = perplexityKey ? "perplexity" : "openai";
    console.log(`Using ${apiToUse} API for keyword suggestions`);

    // Prepare context data
    const existingClusters = context?.existingClusters || [];
    const recentArticles = context?.recentArticles || [];
    
    // Analyze content to generate keyword suggestions
    let suggestions = [];
    
    if (apiToUse === "perplexity") {
      suggestions = await generatePerplexitySuggestions(perplexityKey, existingClusters, recentArticles, source);
    } else {
      suggestions = await generateOpenAISuggestions(openAIKey, existingClusters, recentArticles, source);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        suggestions,
        api_used: apiToUse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error generating suggestions:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to generate keyword suggestions"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function generatePerplexitySuggestions(apiKey: string, clusters: any[], articles: any[], source: string) {
  const prompt = createSuggestionPrompt(clusters, articles, source);
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content: "You are an expert SEO analyst for a mortgage industry publication. You identify valuable keywords for content creation based on search trends, audience interest, and content gaps."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2048,
      temperature: 0.2,
      top_p: 0.9
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(`Perplexity API error: ${response.status} ${error ? JSON.stringify(error) : response.statusText}`);
  }
  
  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  // Parse the content into structured suggestions
  try {
    return parseAIResponse(content);
  } catch (e) {
    console.error("Error parsing Perplexity response:", e);
    throw new Error("Failed to parse Perplexity suggestions");
  }
}

async function generateOpenAISuggestions(apiKey: string, clusters: any[], articles: any[], source: string) {
  const prompt = createSuggestionPrompt(clusters, articles, source);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert SEO analyst for a mortgage industry publication. You identify valuable keywords for content creation based on search trends, audience interest, and content gaps."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2048,
      temperature: 0.2,
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(`OpenAI API error: ${response.status} ${error ? JSON.stringify(error) : response.statusText}`);
  }
  
  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  // Parse the content into structured suggestions
  try {
    return parseAIResponse(content);
  } catch (e) {
    console.error("Error parsing OpenAI response:", e);
    throw new Error("Failed to parse OpenAI suggestions");
  }
}

function createSuggestionPrompt(clusters: any[], articles: any[], source: string) {
  let prompt = `I need keyword suggestions for our mortgage industry publication content strategy. `;
  
  if (clusters && clusters.length > 0) {
    prompt += `\n\nOur current keyword clusters are organized as follows:`;
    clusters.forEach((cluster, i) => {
      if (i < 10) { // Limit to avoid token overload
        prompt += `\n- Primary theme: ${cluster.primary_theme}`;
        if (cluster.sub_theme) prompt += `, Sub-theme: ${cluster.sub_theme}`;
        if (cluster.keywords && cluster.keywords.length > 0) {
          prompt += `\n  Keywords: ${cluster.keywords.slice(0, 7).join(", ")}`;
          if (cluster.keywords.length > 7) prompt += `, ...`;
        }
      }
    });
  }
  
  if (articles && articles.length > 0) {
    prompt += `\n\nRecent content we've published:`;
    articles.forEach((article, i) => {
      if (i < 5) { // Limit to avoid token overload
        prompt += `\n- ${article.headline}`;
      }
    });
  }

  prompt += `\n\nBased on ${source === "news_analysis" ? "recent news and trends" : source}, identify 5-8 valuable keyword opportunities.`;
  
  prompt += `\n\nFor each suggestion, provide:
1. The keyword or phrase
2. A relevance score from 0.1 to 1.0
3. Which existing clusters it might belong to
4. Why this keyword is valuable (rationale)
5. Source of the suggestion (trend, gap analysis, competitive research, etc.)

Return your response in this format - just the JSON with no additional text:
[
  {
    "keyword": "30-year fixed refinance rates",
    "score": 0.92,
    "related_clusters": ["Mortgage Rates", "Refinancing"],
    "rationale": "High search volume with seasonal interest due to recent rate changes",
    "source": "search trend analysis"
  },
  ... additional keywords
]`;

  return prompt;
}

function parseAIResponse(content: string) {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
  
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Failed to parse extracted JSON:", e);
    }
  }
  
  // Alternative parsing if the format is not strictly JSON
  try {
    // Remove any text before or after the JSON array
    const cleanedContent = content.replace(/^[\s\S]*?(\[\s*\{)/m, '[$1').replace(/\}\s*\][\s\S]*$/m, '}]');
    return JSON.parse(cleanedContent);
  } catch (e) {
    console.error("Failed to parse cleaned content:", e);
    throw new Error("Could not parse AI response into structured suggestions");
  }
}
