
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/supabase

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get the Perplexity API key from environment variables
const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");

interface RequestBody {
  source: string;
  context?: {
    existingClusters?: Array<{
      primary_theme: string;
      sub_theme: string;
      keywords: string[];
    }>;
    recentArticles?: Array<{
      headline: string;
      summary: string;
    }>;
  };
}

interface KeywordSuggestion {
  keyword: string;
  score: number;
  related_clusters: string[];
  source: string;
  rationale: string;
}

interface ResponseBody {
  success: boolean;
  suggestions?: KeywordSuggestion[];
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Check if Perplexity API key is available
  if (!perplexityApiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Perplexity API key is not configured",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { source, context } = await req.json() as RequestBody;
    
    console.log("Generating keyword suggestions from source:", source);
    console.log("Context provided:", context ? "Yes" : "No");
    
    // Construct the prompt for Perplexity
    const systemPrompt = `You are an expert SEO and content strategist for a mortgage industry publication named MortgagePoint. 
    You will analyze data to identify valuable keyword clusters and content topics that are:
    1. Trending in the mortgage industry
    2. Relevant to mortgage professionals
    3. Aligned with existing content strategy
    4. Filling gaps in current coverage

    Your suggestions should be well-organized into primary themes and sub-themes, with specific keyword phrases.`;
    
    // Build the user prompt based on existing clusters and recent articles
    let userPrompt = `Please suggest new keyword clusters and specific keywords for our mortgage industry publication.`;
    
    if (context?.existingClusters) {
      userPrompt += `\n\nOur existing keyword clusters are:\n`;
      context.existingClusters.forEach(cluster => {
        userPrompt += `- ${cluster.primary_theme} > ${cluster.sub_theme}: ${cluster.keywords.join(', ')}\n`;
      });
      userPrompt += `\nSuggest complementary keywords that fill gaps in our coverage.`;
    }
    
    if (context?.recentArticles) {
      userPrompt += `\n\nOur recent articles cover:\n`;
      context.recentArticles.forEach(article => {
        userPrompt += `- ${article.headline}: ${article.summary}\n`;
      });
      userPrompt += `\nSuggest keywords that build on these topics or identify untapped related areas.`;
    }
    
    userPrompt += `\n\nFor each suggested keyword provide:
    1. The keyword phrase
    2. A relevance score from 0.1 to 1.0
    3. Related existing clusters it could belong to
    4. Source of suggestion (trend analysis, gap analysis, etc.)
    5. Brief rationale for why this keyword would be valuable

    Return exactly 10 keyword suggestions in a structured format that can be parsed as JSON.`;

    // Call the Perplexity API
    console.log("Calling Perplexity API...");
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000,
        presence_penalty: 0,
        frequency_penalty: 0,
        top_p: 0.9,
        top_k: 40,
        search_domain_filter: ["www.themortgagepoint.com", "mortgagehq.com", "housingwire.com", "nationalmortgagenews.com"],
        search_recency_filter: "month",
        return_search_results: true
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Error from Perplexity API:", data);
      throw new Error(`Perplexity API error: ${data.error || "Unknown error"}`);
    }

    console.log("Received response from Perplexity API");
    
    // Parse the AI-generated content to extract the keyword suggestions
    let suggestions: KeywordSuggestion[] = [];
    
    try {
      const content = data.choices?.[0]?.message?.content;
      
      // This is a simplified parsing approach - in production, this would need more robust extraction
      // Extract JSON if it exists in the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                         content.match(/\[[\s\S]*?\]/);
                         
      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        suggestions = JSON.parse(jsonString);
      } else {
        // Fallback parsing for non-JSON format responses
        // This is simplified - a more robust parser would be needed in production
        const lines = content.split('\n');
        let currentSuggestion: Partial<KeywordSuggestion> = {};
        
        for (const line of lines) {
          if (line.match(/^\d+\.\s/)) {
            // New suggestion
            if (Object.keys(currentSuggestion).length > 0) {
              suggestions.push(currentSuggestion as KeywordSuggestion);
            }
            currentSuggestion = {
              keyword: line.replace(/^\d+\.\s/, '').split(':')[0].trim(),
              score: 0.8, // Default
              related_clusters: [],
              source: "Perplexity Analysis",
              rationale: ""
            };
          } else if (line.includes("Score:") || line.includes("Relevance:")) {
            const scoreMatch = line.match(/(\d+\.\d+)/);
            if (scoreMatch) {
              currentSuggestion.score = parseFloat(scoreMatch[1]);
            }
          } else if (line.includes("Related clusters:") || line.includes("Related Clusters:")) {
            currentSuggestion.related_clusters = line
              .split(":")[1]
              .split(",")
              .map(c => c.trim());
          } else if (line.includes("Source:")) {
            currentSuggestion.source = line.split(":")[1].trim();
          } else if (line.includes("Rationale:") || line.includes("Why:")) {
            currentSuggestion.rationale = line.split(":")[1].trim();
          } else if (currentSuggestion.rationale && line.trim()) {
            // Append to rationale if it's a non-empty line and we're already in rationale
            currentSuggestion.rationale += " " + line.trim();
          }
        }
        
        // Add the last suggestion if it exists
        if (Object.keys(currentSuggestion).length > 0) {
          suggestions.push(currentSuggestion as KeywordSuggestion);
        }
      }
    } catch (error) {
      console.error("Error parsing Perplexity API response:", error);
      console.log("Raw response:", data.choices?.[0]?.message?.content);
      
      // If parsing fails, create a simple response based on the raw text
      const content = data.choices?.[0]?.message?.content || "";
      suggestions = [{
        keyword: "Error parsing suggestions",
        score: 0.5,
        related_clusters: ["Error"],
        source: "API Response Parsing",
        rationale: `Could not parse response. Raw content excerpt: ${content.substring(0, 100)}...`
      }];
    }

    // Return the suggestions
    return new Response(
      JSON.stringify({
        success: true,
        suggestions
      } as ResponseBody),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating keyword suggestions:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      } as ResponseBody),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
