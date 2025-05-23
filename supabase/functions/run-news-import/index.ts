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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase URL or service role key");
    }
    
    // Create Supabase client with admin privileges
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body
    const { manual = false, promptId = null, modelOverride = null } = await req.json().catch(() => ({}));
    
    console.log(`Running news import. Manual: ${manual}, PromptId: ${promptId || 'default'}, ModelOverride: ${modelOverride || 'none'}`);
    
    // If promptId is provided, use that specific prompt
    let keywords = [];
    let minScore = 0.6;
    let limit = 10;
    let promptToUse = promptId;
    
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
      
      // Extract parameters
      keywords = Array.isArray(params.keywords) ? params.keywords : [];
      minScore = params.minScore || 0.6;
      limit = params.limit || 10;
      promptToUse = params.promptId || null;
    }
    
    // Ensure keywords is an array and has at least one default value if empty
    if (keywords.length === 0) {
      // Add some default keywords if none are configured
      keywords = ["mortgage rates", "housing market", "federal reserve", "interest rates", "home equity", "foreclosure"];
      console.log(`No keywords configured, using defaults: ${keywords.join(', ')}`);
    }
    
    console.log(`Running news import with ${keywords.length} keywords, min score ${minScore}, prompt ${promptToUse || 'default'}`);

    // Call the fetch-perplexity-news function
    const { data: newsData, error: fetchError } = await supabase.functions.invoke(
      'fetch-perplexity-news',
      {
        body: {
          keywords,
          promptId: promptToUse,
          minScore,
          limit,
          // Pass model override if provided
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
      // Log the full response to understand what we're getting
      console.log("Got empty articles array. Full response:", JSON.stringify(newsData));
      
      return new Response(JSON.stringify({
        success: false,
        message: "No articles found. Please check keywords and try again.",
        details: { 
          keywords,
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
      
      // Skip system messages or placeholders
      if (article.headline.includes("News Import Information") && article.url === "#") {
        console.log("Skipping system message:", article.headline);
        return false;
      }
      
      // Skip if URL doesn't look like a valid URL
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
        // Check if article URL already exists
        const { data: existing } = await supabase
          .from('news')
          .select('id')
          .eq('url', article.url)
          .maybeSingle();
        
        if (!existing) {
          // For debugging: log the article we're about to insert
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
    
    if (insertedCount === 0 && validArticles.length > 0) {
      console.error("No articles were inserted despite having valid articles to insert. Check for schema issues or duplicates.");
    }
    
    // Log the job execution
    try {
      await supabase
        .from('job_logs')
        .insert([{
          job_name: 'news_import',
          status: insertedCount > 0 ? 'success' : (errorCount > 0 ? 'error' : 'warning'),
          message: insertedCount > 0 ? 
                   `Imported ${insertedCount} new articles` : 
                   `Found ${validArticles.length} articles but none were inserted`,
          execution_time: new Date().toISOString(),
          details: {
            articles_found: newsData.articles.length,
            valid_articles: validArticles.length,
            articles_inserted: insertedCount,
            articles_skipped: skippedCount,
            articles_error: errorCount,
            prompt_used: promptToUse || 'default',
            validation_results: validArticles.map(a => ({
              headline: a.headline,
              url: a.url,
              source: a.source,
              valid: true
            })),
            model_used: modelOverride || 'default from configuration'
          }
        }]);
    } catch (logError) {
      console.error("Failed to log job execution:", logError);
      // Continue execution - this is not a critical error
    }

    // If this was a job from the scheduled task, update its last run timestamp
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
        // Continue execution - this is not a critical error
      }
    }

    return new Response(
      JSON.stringify({
        success: insertedCount > 0,
        message: insertedCount > 0 ? 
                 `News import job ran successfully` : 
                 `Found ${validArticles.length} articles but none were inserted`,
        details: {
          articles_found: newsData.articles.length,
          valid_articles: validArticles.length,
          articles_inserted: insertedCount,
          articles_skipped: skippedCount,
          articles_error: errorCount,
          execution_time: new Date().toISOString(),
          prompt_used: promptToUse || 'default',
          debug: newsData.debug || {},
          articles: validArticles.map(a => ({
            headline: a.headline,
            url: a.url,
            source: a.source
          })),
          model_used: modelOverride || 'default from configuration'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error in run-news-import function:", error);
    
    // Create a Supabase client to log the error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        
        // Log error to job_logs table
        await supabase
          .from('job_logs')
          .insert([{
            job_name: 'news_import',
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            execution_time: new Date().toISOString(),
            details: error instanceof Error ? error.stack : null
          }]);
      }
    } catch (logError) {
      console.error("Could not log error to database:", logError);
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
