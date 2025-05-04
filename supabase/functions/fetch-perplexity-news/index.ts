
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
      keywords: ['mortgage', 'housing market', 'federal reserve', 'interest rates']
    };
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        options = { ...options, ...body };
      } catch (e) {
        console.log("No request body or invalid JSON, using default options");
      }
    }

    console.log(`Fetching Perplexity news with options:`, JSON.stringify(options));
    
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

    // Fetch data from Perplexity
    const fetchNewsFromPerplexity = async (keyword: string): Promise<NewsItem[]> => {
      try {
        // This is a placeholder for the actual Perplexity API call
        // In a real implementation, you would make an API request to Perplexity
        const response = await fetch('https://api.perplexity.ai/news/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: keyword,
            max_results: options.limit / options.keywords.length, // Distribute the limit among keywords
            filter: {
              time_range: '1d', // Last day
              min_score: options.minScore
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.results.map((item: any) => ({
          headline: item.title,
          url: item.url,
          summary: item.summary,
          source: new URL(item.url).hostname,
          perplexity_score: item.relevance_score,
          timestamp: item.published_at,
          matched_clusters: item.categories || [],
          is_competitor_covered: false // This would need a separate check
        }));
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
      
      for (const item of items) {
        try {
          // Skip items with low score
          if (item.perplexity_score < options.minScore) {
            console.log(`Skipping low-scored item (${item.perplexity_score}): ${item.headline}`);
            results.skipped.lowScore++;
            continue;
          }
          
          // Check for duplicates
          const isDuplicate = await checkForDuplicate(item.url);
          if (isDuplicate) {
            console.log(`Skipping duplicate: ${item.headline}`);
            results.skipped.duplicates++;
            continue;
          }
          
          // Insert into database
          const { error } = await supabase.from('news').insert({
            headline: item.headline,
            url: item.url,
            summary: item.summary,
            source: item.source,
            perplexity_score: item.perplexity_score,
            timestamp: item.timestamp || new Date().toISOString(),
            matched_clusters: item.matched_clusters,
            is_competitor_covered: item.is_competitor_covered,
            status: null
          });
          
          if (error) {
            throw new Error(`Database error: ${error.message}`);
          }
          
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
