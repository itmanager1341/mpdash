
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Import the batch insert utility function
const batchInsertPerplexityNews = async (newsItems: any[], options = { skipDuplicateCheck: false, minScore: 0 }) => {
  try {
    const results = {
      total: newsItems.length,
      inserted: 0,
      duplicates: 0,
      lowScore: 0,
      errors: 0,
      invalidData: 0
    };

    if (!Array.isArray(newsItems)) {
      console.error("Invalid data: newsItems is not an array", newsItems);
      return {
        success: false,
        error: "Invalid data: newsItems is not an array",
        results
      };
    }

    console.log(`Processing ${newsItems.length} news items with options:`, options);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process each item individually to apply validation and filtering
    for (const item of newsItems) {
      // Basic data validation
      if (!item || typeof item !== 'object') {
        console.warn("Invalid item in newsItems array:", item);
        results.invalidData++;
        continue;
      }

      // Skip items without URL or headline/title
      if (!item.url || (!item.headline && !item.title)) {
        console.warn("Skipping invalid item missing URL or headline:", item);
        results.invalidData++;
        continue;
      }

      // Skip system messages or placeholders
      if ((item.headline?.includes("News Import Information") || item.title?.includes("News Import Information")) && item.url === "#") {
        console.log("Skipping system message:", item.headline || item.title);
        results.invalidData++;
        continue;
      }

      // Get score from all possible properties
      const score = item.perplexity_score || item.relevance_score || item.score || 0;
      
      // Skip items with low perplexity score
      if (score < options.minScore) {
        console.log(`Skipping low-scored item (${score}): ${item.headline || item.title}`);
        results.lowScore++;
        continue;
      }
      
      // Check for duplicates if not skipped
      if (!options.skipDuplicateCheck) {
        const { data: urlMatch, error: urlError } = await supabase
          .from('news')
          .select('id')
          .eq('url', item.url)
          .maybeSingle();
        
        if (urlError) {
          console.error("Error checking for URL duplicates:", urlError);
        } else if (urlMatch) {
          console.log(`Skipping duplicate: ${item.headline || item.title}`);
          results.duplicates++;
          continue;
        }
      }
      
      // Insert the item
      try {
        const title = item.headline || item.title || "";
        const summary = item.summary || item.description || "";
        const source = item.source || (item.url ? new URL(item.url).hostname.replace('www.', '') : "");
        const scoreValue = item.perplexity_score || item.relevance_score || item.score || 0.5;
        const matched_clusters = Array.isArray(item.matched_clusters) ? item.matched_clusters : 
                                 Array.isArray(item.clusters) ? item.clusters : [];
                                 
        const cleanedItem = {
          original_title: title.trim(),
          url: item.url.trim(),
          summary: summary.trim(),
          source: source.trim(),
          perplexity_score: parseFloat(scoreValue.toString()),
          timestamp: item.timestamp || new Date().toISOString(),
          matched_clusters: matched_clusters,
          is_competitor_covered: Boolean(item.is_competitor_covered),
          status: 'pending',
          destinations: []
        };
        
        console.log("Attempting to insert news item:", JSON.stringify(cleanedItem));
        
        const { error } = await supabase
          .from('news')
          .insert(cleanedItem);
        
        if (error) {
          console.error("Database error inserting news item:", error);
          results.errors++;
        } else {
          console.log("Successfully inserted news item:", cleanedItem.original_title);
          results.inserted++;
        }
      } catch (insertError) {
        console.error("Error inserting news item:", insertError);
        results.errors++;
      }
    }
    
    return { 
      success: results.inserted > 0, 
      results 
    };
  } catch (err) {
    console.error("Error batch inserting news items:", err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err) 
    };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      manual = false, 
      promptId, 
      modelOverride, 
      limit = 20,
      triggeredBy = 'manual'
    } = await req.json();

    console.log('News import request:', { manual, promptId, modelOverride, limit, triggeredBy });

    // Get the prompt if specified to use proper job name
    let prompt = null;
    let jobName = 'manual_news_import';
    
    if (promptId) {
      const { data: promptData, error: promptError } = await supabase
        .from('llm_prompts')
        .select('*')
        .eq('id', promptId)
        .eq('is_active', true)
        .single();

      if (promptError) {
        throw new Error(`Failed to fetch prompt: ${promptError.message}`);
      }

      prompt = promptData;
      // Use the prompt's function name for better job identification
      jobName = prompt.function_name || `news_search_${promptId}`;
    }

    // Log job execution start with descriptive name
    const { data: logData, error: logError } = await supabase.rpc('log_job_execution', {
      p_job_name: jobName,
      p_execution_type: manual ? 'manual' : 'scheduled',
      p_status: 'running',
      p_message: 'Starting news import process',
      p_parameters_used: { promptId, modelOverride, limit, triggeredBy }
    });

    if (logError) {
      console.error('Error logging job execution:', logError);
    }

    const logId = logData;

    try {
      // Determine which model to use
      let modelToUse = modelOverride;
      if (!modelToUse && prompt) {
        modelToUse = prompt.model;
      }
      if (!modelToUse) {
        modelToUse = 'llama-3.1-sonar-small-128k-online'; // Default fallback
      }

      console.log('Using model:', modelToUse);

      // Route to appropriate provider based on model
      let importResult;
      if (modelToUse.includes('sonar') || modelToUse.includes('perplexity')) {
        // Call Perplexity-specific function
        const perplexityResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-perplexity-news`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt?.prompt_text || 'Search for the latest mortgage industry news',
            model: modelToUse,
            limit,
            promptId,
            triggeredBy
          })
        });

        if (!perplexityResponse.ok) {
          throw new Error(`Perplexity fetch failed: ${perplexityResponse.statusText}`);
        }

        const perplexityData = await perplexityResponse.json();
        
        // Now insert the articles into the database
        if (perplexityData.articles && perplexityData.articles.length > 0) {
          console.log(`Inserting ${perplexityData.articles.length} articles into database`);
          
          const insertResult = await batchInsertPerplexityNews(perplexityData.articles, {
            skipDuplicateCheck: false,
            minScore: 0
          });
          
          console.log('Database insertion result:', insertResult);
          
          importResult = {
            articles_found: perplexityData.articles.length,
            articles_inserted: insertResult.results?.inserted || 0,
            articles_skipped: insertResult.results?.duplicates || 0,
            articles_error: insertResult.results?.errors || 0,
            search_metadata: perplexityData.search_metadata || {},
            insertion_details: insertResult.results
          };
        } else {
          importResult = {
            articles_found: 0,
            articles_inserted: 0,
            articles_skipped: 0,
            articles_error: 0,
            search_metadata: perplexityData.search_metadata || {}
          };
        }
      } else if (modelToUse.includes('gpt')) {
        // Future: Route to OpenAI search function
        throw new Error('OpenAI news search not yet implemented');
      } else {
        throw new Error(`Unsupported model for news search: ${modelToUse}`);
      }

      // Update job execution status to success
      if (logId) {
        await supabase.rpc('update_job_execution_status', {
          p_log_id: logId,
          p_status: 'success',
          p_message: `Successfully imported ${importResult.articles_inserted || 0} articles`,
          p_details: importResult
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `News import completed successfully`,
        details: importResult,
        model_used: modelToUse,
        prompt_used: prompt?.function_name || 'default'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Error in news import:', error);
      
      // Update job execution status to error
      if (logId) {
        await supabase.rpc('update_job_execution_status', {
          p_log_id: logId,
          p_status: 'error',
          p_message: error.message,
          p_details: { error: error.message, stack: error.stack }
        });
      }

      throw error;
    }

  } catch (error) {
    console.error('Error in run-news-import function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
