
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

// Configure CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let logId: string | null = null;
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase URL or service role key");
    }
    
    // Create Supabase client with admin privileges
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body
    const { manual = false, promptId = null, modelOverride = null, limit = null, triggeredBy = null } = await req.json().catch(() => ({}));
    
    const executionType = manual ? 'manual' : 'scheduled';
    const jobName = promptId ? `news_search_${promptId.substring(0, 8)}` : 'news_import';
    
    console.log(`Running news import. Manual: ${manual}, PromptId: ${promptId || 'default'}, ModelOverride: ${modelOverride || 'none'}, Limit: ${limit || 'default'}`);
    
    // Start logging the job execution
    const { data: logResult } = await supabase.rpc('log_job_execution', {
      p_job_name: jobName,
      p_execution_type: executionType,
      p_status: 'running',
      p_message: 'Starting news import job',
      p_triggered_by: triggeredBy
    });
    
    logId = logResult;
    
    // If promptId is provided, use that specific prompt
    let keywords = [];
    let minScore = 0.6;
    let finalLimit = limit || 10;
    let promptToUse = promptId;
    let jobParameters = {};
    
    // Try to get the job configuration first if no specific prompt is provided
    if (!promptId) {
      const { data: jobConfig, error: configError } = await supabase
        .from('scheduled_job_settings')
        .select('*')
        .eq('job_name', 'news_import')
        .maybeSingle();
        
      if (configError) {
        throw new Error(`Failed to fetch job config: ${configError.message}`);
      }

      if (!jobConfig) {
        throw new Error("News import job configuration not found");
      }

      // Check if job is enabled or manual override
      if (!jobConfig.is_enabled && !manual) {
        if (logId) {
          await supabase.rpc('update_job_execution_status', {
            p_log_id: logId,
            p_status: 'error',
            p_message: 'News import job is disabled'
          });
        }
        
        return new Response(JSON.stringify({
          success: false,
          message: "News import job is disabled",
          info: "Use manual=true parameter to run anyway"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Extract parameters from job config
      const params = jobConfig.parameters || {};
      jobParameters = params;
      
      keywords = Array.isArray(params.keywords) ? params.keywords : [];
      minScore = params.minScore || 0.6;
      finalLimit = params.limit || finalLimit;
      promptToUse = params.promptId || null;
    }
    
    // Ensure keywords is an array and has at least one default value if empty
    if (keywords.length === 0) {
      keywords = ["mortgage rates", "housing market", "federal reserve", "interest rates", "home equity", "foreclosure"];
      console.log(`No keywords configured, using defaults: ${keywords.join(', ')}`);
    }
    
    // Update log with job parameters
    if (logId) {
      await supabase.rpc('update_job_execution_status', {
        p_log_id: logId,
        p_status: 'running',
        p_message: `Running with ${keywords.length} keywords, min score ${minScore}, limit ${finalLimit}`,
        p_details: {
          parameters_used: {
            keywords,
            minScore,
            limit: finalLimit,
            promptId: promptToUse,
            modelOverride
          }
        }
      });
    }
    
    console.log(`Running news import with ${keywords.length} keywords, min score ${minScore}, limit ${finalLimit}, prompt ${promptToUse || 'default'}`);

    // Call the fetch-perplexity-news function
    const { data: newsData, error: fetchError } = await supabase.functions.invoke(
      'fetch-perplexity-news',
      {
        body: {
          keywords,
          promptId: promptToUse,
          minScore,
          limit: finalLimit,
          ...(modelOverride ? { modelOverride } : {})
        }
      }
    );

    if (fetchError) {
      console.error("Error calling fetch-perplexity-news:", fetchError);
      throw new Error(`Failed to fetch news: ${fetchError.message}`);
    }

    if (!newsData || !newsData.articles) {
      console.error("No articles returned from news fetch or invalid format:", newsData);
      throw new Error("No articles returned from news fetch or invalid response format");
    }

    console.log(`Successfully fetched ${newsData.articles.length} articles`);
    
    if (newsData.articles.length === 0) {
      console.log("Got empty articles array. Full response:", JSON.stringify(newsData));
      
      if (logId) {
        await supabase.rpc('update_job_execution_status', {
          p_log_id: logId,
          p_status: 'success',
          p_message: 'No articles found matching criteria',
          p_details: {
            articles_found: 0,
            keywords_used: keywords,
            response_debug: newsData
          }
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        message: "No articles found. Please check keywords and try again.",
        details: { 
          keywords,
          limit: finalLimit,
          response: newsData
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Format articles for insertion
    const articlesToInsert = newsData.articles.map(article => ({
      headline: article.title || article.headline || "",
      url: article.url || "",
      summary: article.summary || article.description || "",
      source: article.source || (article.url ? new URL(article.url).hostname.replace('www.', '') : ""),
      perplexity_score: article.relevance_score || article.score || 0.7,
      matched_clusters: Array.isArray(article.matched_clusters) ? article.matched_clusters : 
                         Array.isArray(article.clusters) ? article.clusters : [],
      status: 'pending',
      is_competitor_covered: article.is_competitor_covered || false,
      timestamp: new Date().toISOString()
    }));
    
    // Validate articles before insertion
    const validArticles = articlesToInsert.filter(article => {
      if (!article.headline || !article.url) {
        console.warn("Skipping invalid article missing headline or URL:", article);
        return false;
      }
      
      if (article.headline.includes("News Import Information") && article.url === "#") {
        console.log("Skipping system message:", article.headline);
        return false;
      }
      
      try {
        new URL(article.url);
        return true;
      } catch (e) {
        console.warn("Skipping article with invalid URL format:", article.url);
        return false;
      }
    });
    
    if (validArticles.length === 0) {
      console.error("No valid articles to insert after filtering");
      
      if (logId) {
        await supabase.rpc('update_job_execution_status', {
          p_log_id: logId,
          p_status: 'error',
          p_message: 'No valid articles found for insertion',
          p_details: {
            original_count: newsData.articles.length,
            valid_count: 0,
            debug: newsData.debug || {}
          }
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        message: "No valid articles found for insertion",
        details: {
          original_count: newsData.articles.length,
          debug: newsData.debug || {}
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Insert only new articles (skip if URL already exists)
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`Attempting to insert ${validArticles.length} valid articles`);
    
    for (const article of validArticles) {
      try {
        const { data: existing } = await supabase
          .from('news')
          .select('id')
          .eq('url', article.url)
          .maybeSingle();
        
        if (!existing) {
          console.log(`Inserting article: "${article.headline}" from ${article.source}`);
          
          const { error: insertError } = await supabase
            .from('news')
            .insert([article]);
            
          if (!insertError) {
            insertedCount++;
            console.log(`Successfully inserted article: ${article.headline}`);
          } else {
            console.error(`Failed to insert article: ${insertError.message}`, article);
            errorCount++;
          }
        } else {
          console.log(`Skipping duplicate article with URL: ${article.url}`);
          skippedCount++;
        }
      } catch (insertErr) {
        console.error("Error processing article:", insertErr, "Article data:", article);
        errorCount++;
      }
    }
    
    // Update job execution status
    const finalStatus = insertedCount > 0 ? 'success' : (errorCount > 0 ? 'error' : 'success');
    const finalMessage = insertedCount > 0 ? 
                        `Successfully imported ${insertedCount} new articles` : 
                        `Found ${validArticles.length} articles but none were new`;
    
    if (logId) {
      await supabase.rpc('update_job_execution_status', {
        p_log_id: logId,
        p_status: finalStatus,
        p_message: finalMessage,
        p_details: {
          articles_found: newsData.articles.length,
          valid_articles: validArticles.length,
          articles_inserted: insertedCount,
          articles_skipped: skippedCount,
          articles_error: errorCount,
          model_used: modelOverride || 'default from configuration',
          execution_summary: {
            keywords_used: keywords,
            min_score_threshold: minScore,
            limit_applied: finalLimit
          }
        }
      });
    }

    // If this was a scheduled job, update its last run timestamp
    if (!manual && !promptId) {
      try {
        await supabase
          .from('scheduled_job_settings')
          .update({ 
            last_run: new Date().toISOString(),
            last_run_result: {
              total_fetched: newsData.articles.length,
              inserted: insertedCount,
              execution_time: new Date().toISOString()
            }
          })
          .eq('job_name', 'news_import');
      } catch (updateError) {
        console.error("Failed to update job status:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: insertedCount > 0,
        message: finalMessage,
        details: {
          articles_found: newsData.articles.length,
          valid_articles: validArticles.length,
          articles_inserted: insertedCount,
          articles_skipped: skippedCount,
          articles_error: errorCount,
          execution_time: new Date().toISOString(),
          log_id: logId,
          model_used: modelOverride || 'default from configuration'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error in run-news-import function:", error);
    
    // Update log with error if we have a log ID
    if (logId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') || '', 
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        
        await supabase.rpc('update_job_execution_status', {
          p_log_id: logId,
          p_status: 'error',
          p_message: error instanceof Error ? error.message : 'Unknown error occurred',
          p_details: {
            error_type: error instanceof Error ? error.constructor.name : 'UnknownError',
            error_stack: error instanceof Error ? error.stack : null
          }
        });
      } catch (logError) {
        console.error("Could not update error log:", logError);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.stack : null
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
