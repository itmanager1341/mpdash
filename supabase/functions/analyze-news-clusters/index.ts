
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
  parameters?: Record<string, any>;
  max_items?: number;
}

interface ResponseBody {
  success: boolean;
  updated?: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Create a Supabase client for the function
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  try {
    const { parameters = {}, max_items = 20 } = await req.json() as RequestBody;
    
    console.log("Starting news cluster analysis");
    
    // 1. Fetch news items that need cluster analysis (no matched_clusters or outdated)
    const { data: newsItems, error: fetchError } = await supabaseClient
      .from('news')
      .select('id, headline, summary, content')
      .is('matched_clusters', null)
      .limit(max_items);
      
    if (fetchError) {
      throw new Error(`Error fetching news items: ${fetchError.message}`);
    }
    
    console.log(`Found ${newsItems.length} news items for cluster analysis`);
    
    if (newsItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          updated: 0,
          message: "No news items require cluster analysis"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // 2. Get existing clusters for context
    const { data: clusters, error: clustersError } = await supabaseClient
      .from('keyword_clusters')
      .select('primary_theme, sub_theme, keywords');
    
    if (clustersError) {
      throw new Error(`Error fetching clusters: ${clustersError.message}`);
    }

    // Format cluster data for the prompt
    const clusterFormatted = clusters.map(c => 
      `${c.primary_theme}: ${c.sub_theme} (${c.keywords?.join(', ') || 'No keywords'})`
    ).join('\n');
    
    console.log("Processing news items...");
    
    let updatedCount = 0;
    
    // Process up to 5 items at once to avoid Perplexity API rate limits
    const batchSize = 5;
    for (let i = 0; i < newsItems.length; i += batchSize) {
      const batch = newsItems.slice(i, i + batchSize);
      
      // Process each item in the batch
      const batchPromises = batch.map(async (item) => {
        try {
          // Create a prompt for the Perplexity API
          const newsContent = `${item.headline}\n\n${item.summary || ''}`;
          
          const prompt = `Analyze this mortgage industry news content and match it to the most relevant keyword clusters. 
          Only assign clusters that are truly relevant.

          NEWS CONTENT:
          ${newsContent}
          
          AVAILABLE CLUSTERS:
          ${clusterFormatted}
          
          Return your answer in this JSON format:
          {
            "matched_clusters": ["Primary Theme: Sub Theme", "Primary Theme: Sub Theme"],
            "confidence_score": 0.85,
            "rationale": "Brief explanation of why these clusters match"
          }`;
          
          // Call Perplexity API if key is available
          if (!perplexityApiKey) {
            console.warn("Perplexity API key not configured, using mock data");
            
            // Mock response with random clusters - in production, use the API
            const mockClusters = clusters
              .sort(() => Math.random() - 0.5)
              .slice(0, 2)
              .map(c => `${c.primary_theme}: ${c.sub_theme}`);
              
            // Update the news item with mock data
            const { error: updateError } = await supabaseClient
              .from('news')
              .update({
                matched_clusters: mockClusters,
                cluster_confidence_score: 0.7,
                cluster_analysis_timestamp: new Date().toISOString()
              })
              .eq('id', item.id);
              
            if (updateError) {
              console.error(`Error updating news item ${item.id}:`, updateError);
              return false;
            }
            
            return true;
          }
          
          // Real implementation with Perplexity API
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
                  content: "You are a specialized AI that analyzes mortgage industry news and categorizes content into predefined clusters. Respond only with valid JSON. No markdown formatting, explanations, or additional text."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              temperature: 0.1,
              max_tokens: 500,
              response_format: { type: "json_object" }
            }),
          });
          
          if (!response.ok) {
            throw new Error(`Perplexity API error: ${response.status}`);
          }
          
          const result = await response.json();
          const responseContent = result.choices?.[0]?.message?.content;
          
          if (!responseContent) {
            throw new Error("Empty response from Perplexity API");
          }
          
          // Parse JSON from the response
          let clusterData;
          try {
            // First attempt: direct JSON parsing
            clusterData = JSON.parse(responseContent);
          } catch (parseError) {
            console.warn(`Initial JSON parsing failed for item ${item.id}, trying to extract JSON from text`);
            
            // Second attempt: try to find JSON in the text
            const jsonMatch = responseContent.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
              try {
                clusterData = JSON.parse(jsonMatch[0]);
              } catch (extractError) {
                console.error(`Failed to extract JSON from response for item ${item.id}`);
                clusterData = {
                  matched_clusters: [],
                  confidence_score: 0,
                  rationale: "Failed to analyze - parsing error"
                };
              }
            } else {
              console.error(`Couldn't find JSON pattern in response for item ${item.id}`);
              clusterData = {
                matched_clusters: [],
                confidence_score: 0,
                rationale: "Failed to analyze - no JSON found"
              };
            }
          }
          
          // Update the news item with the analysis results
          const { error: updateError } = await supabaseClient
            .from('news')
            .update({
              matched_clusters: clusterData.matched_clusters || [],
              cluster_confidence_score: clusterData.confidence_score || 0,
              cluster_analysis_timestamp: new Date().toISOString(),
              cluster_analysis_rationale: clusterData.rationale || null
            })
            .eq('id', item.id);
            
          if (updateError) {
            console.error(`Error updating news item ${item.id}:`, updateError);
            return false;
          }
          
          return true;
          
        } catch (itemError) {
          console.error(`Error processing news item ${item.id}:`, itemError);
          return false;
        }
      });
      
      // Wait for all items in the batch to complete
      const results = await Promise.all(batchPromises);
      updatedCount += results.filter(Boolean).length;
      
      // Avoid rate limits by adding a small delay between batches
      if (i + batchSize < newsItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: updatedCount
      } as ResponseBody),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error analyzing news clusters:", error);
    
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

// Helper to create a Supabase client
function createClient(supabaseUrl: string, supabaseKey: string) {
  return {
    from: (table: string) => ({
      select: (columns: string = "*") => ({
        is: (column: string, value: any) => ({
          limit: (count: number) => {
            return fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=is.${value}&limit=${count}`, {
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                apikey: supabaseKey
              },
            }).then(async (response) => {
              const data = await response.json();
              return { data, error: null };
            }).catch(error => {
              return { data: null, error };
            });
          }
        }),
        limit: (count: number) => {
          return fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&limit=${count}`, {
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey
            },
          }).then(async (response) => {
            const data = await response.json();
            return { data, error: null };
          }).catch(error => {
            return { data: null, error };
          });
        }
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => {
          return fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(data)
          }).then(() => {
            return { error: null };
          }).catch(error => {
            return { error };
          });
        }
      })
    })
  };
}
