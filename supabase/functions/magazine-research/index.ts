
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // Create a Supabase client with the Admin key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (!perplexityKey) {
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
      depth = "standard"  // Can be "quick", "standard", or "deep"
    } = await req.json();
    
    // Validate required params
    if (!topic) {
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
        // Add cluster keywords to context
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

    // Call Perplexity API
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
        temperature: 0.3, // Lower temperature for more factual responses
        max_tokens: 2048,
        return_related_questions: true,
        // Fix: Use domain names for search_domain_filter instead of broad categories
        search_domain_filter: ["perplexity.ai", "wsj.com", "bloomberg.com", "mortgagenewsdaily.com"],
        search_recency_filter: "month" // Focus on recent information
      })
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      throw new Error(`Perplexity API error: ${perplexityResponse.status} - ${errorText}`);
    }
    
    const perplexityData = await perplexityResponse.json();
    
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
    
  } catch (error) {
    console.error('Error in magazine-research function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
