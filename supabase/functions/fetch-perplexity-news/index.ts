
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  headline: string;
  url: string;
  summary: string;
  source: string;
  perplexity_score: number;
  timestamp: string;
  matched_clusters: string[];
  is_competitor_covered: boolean;
}

interface FetchOptions {
  minScore: number;
  skipDuplicateCheck: boolean;
  limit: number;
  keywords: string[];
  customPrompt?: string;
  model?: string;
  temperature?: number;
  search_domain_filter?: string;
  search_recency_filter?: string;
  max_tokens?: number;
  promptId?: string;
}

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

    // Parse request body for options or use defaults
    let options: FetchOptions = {
      minScore: 2.0,
      skipDuplicateCheck: false,
      limit: 10,
      keywords: ['mortgage', 'housing market', 'federal reserve', 'interest rates'],
      model: 'llama-3.1-sonar-small-128k-online',
      temperature: 0.2,
      search_domain_filter: 'auto',
      search_recency_filter: 'day',
      max_tokens: 1000
    };
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        options = { ...options, ...body };
        // Ensure keywords is an array
        if (typeof options.keywords === 'string') {
          options.keywords = [options.keywords];
        }
      } catch (e) {
        console.log("No request body or invalid JSON, using default options");
      }
    }

    // Log the execution
    console.log(`Starting Perplexity news fetch with options:`, JSON.stringify(options));
    
    // Update the last_run timestamp in the scheduled_job_settings table
    if (req.headers.get('user-agent')?.includes('pg_net')) {
      // This request came from the cron job
      await supabase
        .from('scheduled_job_settings')
        .update({ last_run: new Date().toISOString() })
        .eq('job_name', 'daily-perplexity-news-fetch');
      
      console.log('Updated last_run timestamp for cron job');
    }
    
    // Check for duplicates by URL
    const checkForDuplicate = async (url: string): Promise<boolean> => {
      if (options.skipDuplicateCheck) return false;
      
      const { data, error } = await supabase
        .from('news')
        .select('id')
        .eq('url', url)
        .maybeSingle();
      
      if (error) {
        console.error("Error checking for duplicates:", error);
        return false; // Proceed with import if we can't check
      }
      
      return !!data;
    };

    // If promptId is provided, fetch the prompt from the database
    let customPrompt = options.customPrompt;
    if (options.promptId && !customPrompt) {
      const { data: promptData, error: promptError } = await supabase
        .from('llm_prompts')
        .select('*')
        .eq('id', options.promptId)
        .maybeSingle();
      
      if (promptError) {
        throw new Error(`Error fetching prompt: ${promptError.message}`);
      }
      
      if (promptData) {
        // Extract any metadata from the prompt
        const metadataMatch = promptData.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
        let metadata = {};
        if (metadataMatch) {
          try {
            metadata = JSON.parse(metadataMatch[1]);
            // Apply metadata settings if not overridden in options
            if (metadata.search_settings) {
              options.temperature = options.temperature ?? metadata.search_settings.temperature;
              options.search_domain_filter = options.search_domain_filter ?? metadata.search_settings.domain_filter;
              options.search_recency_filter = options.search_recency_filter ?? metadata.search_settings.recency_filter;
              options.max_tokens = options.max_tokens ?? metadata.search_settings.max_tokens;
            }
            // Remove metadata from prompt text
            customPrompt = promptData.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '');
          } catch (e) {
            console.error("Error parsing prompt metadata:", e);
            customPrompt = promptData.prompt_text;
          }
        } else {
          customPrompt = promptData.prompt_text;
        }
        
        // Set the model from the prompt if not specified in options
        options.model = options.model || promptData.model;
        
        // Handle includes
        if (promptData.include_clusters) {
          // Fetch clusters to include in prompt context
          const { data: clusters } = await supabase
            .from('keyword_clusters')
            .select('primary_theme, sub_theme, keywords');
          
          if (clusters && clusters.length > 0) {
            const clustersText = clusters.map(c => 
              `${c.primary_theme}: ${c.sub_theme} [${c.keywords?.slice(0, 5).join(', ')}${c.keywords?.length > 5 ? '...' : ''}]`
            ).join('\n');
            
            customPrompt = customPrompt.replace('[CLUSTERS]', 
              `KEYWORD CLUSTERS:\n${clustersText}\n\nUse these clusters to categorize the news items.`
            );
          } else {
            customPrompt = customPrompt.replace('[CLUSTERS]', '');
          }
        }
        
        if (promptData.include_tracking_summary) {
          // Fetch tracked keywords
          const { data: tracking } = await supabase
            .from('keyword_tracking')
            .select('keyword, priority')
            .order('priority');
          
          if (tracking && tracking.length > 0) {
            const trackingText = tracking.map(t => 
              `${t.keyword} (${t.priority || 'medium'})`
            ).join(', ');
            
            customPrompt = customPrompt.replace('[TRACKING]', 
              `TRACKED KEYWORDS: ${trackingText}\n\nPrioritize content related to these keywords.`
            );
          } else {
            customPrompt = customPrompt.replace('[TRACKING]', '');
          }
        }
      }
    }

    // Fetch data from Perplexity
    const fetchNewsFromPerplexity = async (keyword: string): Promise<NewsItem[]> => {
      try {
        console.log(`Fetching news for keyword: ${keyword}`);
        
        // Determine if we need to use the chat API (for custom prompts) or search API
        if (customPrompt) {
          // Use the chat API with a custom prompt
          console.log(`Using custom prompt with model: ${options.model}`);
          
          // Replace [QUERY] placeholder with the actual keyword
          const finalPrompt = customPrompt.replace(/\[QUERY\]/g, keyword);
          
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: options.model || 'llama-3.1-sonar-small-128k-online',
              messages: [
                {
                  role: 'system',
                  content: 'You are a specialized search assistant for the mortgage industry. Provide factual and relevant information.'
                },
                {
                  role: 'user',
                  content: finalPrompt
                }
              ],
              temperature: options.temperature || 0.2,
              max_tokens: options.max_tokens || 1000,
              top_p: 0.9,
              search_domain_filter: options.search_domain_filter || 'auto',
              search_recency_filter: options.search_recency_filter || 'day'
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          if (!content) {
            throw new Error("Empty response from Perplexity API");
          }
          
          // Try to extract structured data from the response
          let newsItems: NewsItem[] = [];
          
          try {
            // Look for JSON in the response
            const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || 
                             content.match(/\[\s*\{\s*".*"\s*:.*\}\s*\]/s);
            
            if (jsonMatch) {
              const jsonStr = jsonMatch[1] || jsonMatch[0];
              const parsedData = JSON.parse(jsonStr);
              
              // Check if it's an array of news items
              if (Array.isArray(parsedData)) {
                newsItems = parsedData.map(item => {
                  // Normalize the structure
                  return {
                    headline: item.headline || item.title,
                    url: item.url || item.link,
                    summary: item.summary || item.description,
                    source: item.source || new URL(item.url || item.link).hostname,
                    perplexity_score: item.relevance_score || item.score || options.minScore + 0.1,
                    timestamp: item.published_at || item.date || new Date().toISOString(),
                    matched_clusters: item.clusters || item.matched_clusters || [],
                    is_competitor_covered: !!item.is_competitor_covered
                  };
                });
              }
            } 
            
            // If we couldn't extract JSON, try to parse as plain text
            if (newsItems.length === 0) {
              console.log("Could not extract JSON from response, treating as plain text");
              
              // Basic fallback parsing - create a single item
              newsItems = [{
                headline: `News about ${keyword}`,
                url: `https://search.perplexity.ai/search?q=${encodeURIComponent(keyword)}`,
                summary: content.length > 500 ? content.substring(0, 500) + "..." : content,
                source: "perplexity.ai",
                perplexity_score: options.minScore + 0.1,
                timestamp: new Date().toISOString(),
                matched_clusters: [],
                is_competitor_covered: false
              }];
            }
          } catch (e) {
            console.error("Error parsing Perplexity response:", e);
            return [];
          }
          
          return newsItems;
        } else {
          // Use the regular search API
          const response = await fetch('https://api.perplexity.ai/news/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query: keyword,
              max_results: Math.ceil(options.limit / options.keywords.length), // Distribute the limit among keywords
              filter: {
                time_range: options.search_recency_filter || '1d', 
                min_score: options.minScore
              }
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          const data = await response.json();
          if (!data.results || !Array.isArray(data.results)) {
            console.log(`No results for keyword "${keyword}" or unexpected response format`, data);
            return [];
          }
          
          console.log(`Received ${data.results.length} results for keyword "${keyword}"`);
          
          return data.results.map((item: any) => {
            // Extract domain from URL for source
            let source;
            try {
              source = new URL(item.url).hostname;
            } catch (e) {
              source = 'unknown';
            }
            
            return {
              headline: item.title,
              url: item.url,
              summary: item.summary,
              source: source,
              perplexity_score: item.relevance_score,
              timestamp: item.published_at || new Date().toISOString(),
              matched_clusters: item.categories || [],
              is_competitor_covered: false // This would need a separate check
            };
          });
        }
      } catch (error) {
        console.error(`Error fetching news for keyword "${keyword}":`, error);
        return [];
      }
    };
    
    // Process and insert the news items
    const processNewsItems = async (items: NewsItem[]): Promise<{
      total: number;
      inserted: number;
      skipped: {
        duplicates: number;
        lowScore: number;
      };
      errors: {
        count: number;
        messages: string[];
      };
    }> => {
      const results = {
        total: items.length,
        inserted: 0,
        skipped: {
          duplicates: 0,
          lowScore: 0
        },
        errors: {
          count: 0,
          messages: []
        }
      };
      
      // Deduplicate items by URL
      const uniqueItems = items.filter((item, index, self) => 
        index === self.findIndex((i) => i.url === item.url)
      );
      
      console.log(`Processing ${uniqueItems.length} unique items out of ${items.length} total`);
      
      for (const item of uniqueItems) {
        try {
          // Skip items with low score
          if (item.perplexity_score < options.minScore) {
            console.log(`Skipping low-scored item (${item.perplexity_score}): ${item.headline}`);
            results.skipped.lowScore++;
            continue;
          }
          
          // Check for duplicates in the database
          const isDuplicate = await checkForDuplicate(item.url);
          if (isDuplicate) {
            console.log(`Skipping duplicate: ${item.headline}`);
            results.skipped.duplicates++;
            continue;
          }
          
          // Match to clusters in the database
          const { data: clusters, error: clustersError } = await supabase
            .from('keyword_clusters')
            .select('id, keywords, primary_theme, sub_theme');
            
          if (clustersError) {
            console.error("Error fetching clusters:", clustersError);
          } else if (clusters) {
            // If item doesn't have matched clusters already, try to match it
            if (!item.matched_clusters || item.matched_clusters.length === 0) {
              // Match article to clusters based on keywords
              const matchedClusters = clusters
                .filter(cluster => {
                  if (!cluster.keywords) return false;
                  
                  // Check if any cluster keyword appears in the headline or summary
                  return cluster.keywords.some((keyword: string) => {
                    const keyword_lower = keyword.toLowerCase();
                    return (
                      item.headline.toLowerCase().includes(keyword_lower) || 
                      (item.summary && item.summary.toLowerCase().includes(keyword_lower))
                    );
                  });
                })
                .map(cluster => `${cluster.primary_theme}: ${cluster.sub_theme}`);
              
              if (matchedClusters.length > 0) {
                item.matched_clusters = matchedClusters;
              }
            }
          }
          
          // Insert into database
          const { error } = await supabase.from('news').insert({
            headline: item.headline,
            url: item.url,
            summary: item.summary,
            source: item.source,
            perplexity_score: item.perplexity_score,
            timestamp: item.timestamp,
            matched_clusters: item.matched_clusters || [],
            is_competitor_covered: item.is_competitor_covered,
            status: null,
            destinations: []
          });
          
          if (error) {
            throw new Error(`Database error: ${error.message}`);
          }
          
          console.log(`Inserted: ${item.headline}`);
          results.inserted++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Error processing item ${item.headline}:`, message);
          results.errors.count++;
          results.errors.messages.push(message);
        }
      }
      
      return results;
    };
    
    // Fetch news for all keywords
    const allNewsItems: NewsItem[] = [];
    for (const keyword of options.keywords) {
      const items = await fetchNewsFromPerplexity(keyword);
      allNewsItems.push(...items);
    }
    
    // Process and insert the news items
    const results = await processNewsItems(allNewsItems);
    
    console.log(`News fetch completed: ${results.inserted} inserted, ${results.skipped.duplicates} duplicates, ${results.skipped.lowScore} low score, ${results.errors.count} errors`);
    
    // Return the results
    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in fetch-perplexity-news function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
