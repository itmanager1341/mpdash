
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
    const { manual = false } = await req.json().catch(() => ({}));
    
    // Try to get the job configuration first
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
    const keywords = Array.isArray(params.keywords) ? params.keywords : [];
    const minScore = params.minScore || 0.6;
    const limit = params.limit || 10;
    const promptId = params.promptId || null;
    
    console.log(`Running news import with ${keywords.length} keywords, min score ${minScore}`);

    // Call the fetch-perplexity-news function
    const { data: newsData, error: fetchError } = await supabase.functions.invoke(
      'fetch-perplexity-news',
      {
        body: {
          keywords,
          promptId,
          minScore,
          limit
        }
      }
    );

    if (fetchError) {
      throw new Error(`Failed to fetch news: ${fetchError.message}`);
    }

    if (!newsData || !newsData.articles) {
      throw new Error("No articles returned from news fetch");
    }

    console.log(`Successfully fetched ${newsData.articles.length} articles`);
    
    // Format articles for insertion
    const articlesToInsert = newsData.articles.map(article => ({
      headline: article.title,
      url: article.url,
      summary: article.summary || article.description,
      source: article.source || new URL(article.url).hostname.replace('www.', ''),
      perplexity_score: article.relevance_score || 0.7,
      matched_clusters: article.clusters || article.matched_clusters || [],
      status: 'pending',
      is_competitor_covered: article.is_competitor_covered || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    // Insert only new articles (skip if URL already exists)
    let insertedCount = 0;
    for (const article of articlesToInsert) {
      // Check if article URL already exists
      const { data: existing } = await supabase
        .from('news')
        .select('id')
        .eq('url', article.url)
        .maybeSingle();
      
      if (!existing) {
        const { error: insertError } = await supabase
          .from('news')
          .insert([article]);
          
        if (!insertError) {
          insertedCount++;
        } else {
          console.error(`Failed to insert article: ${insertError.message}`);
        }
      }
    }
    
    // Update the job's last_run timestamp
    await supabase
      .from('scheduled_job_settings')
      .update({ 
        last_run: new Date().toISOString(),
        last_run_result: JSON.stringify({
          total_fetched: newsData.articles.length,
          inserted: insertedCount,
          execution_time: new Date().toISOString()
        })
      })
      .eq('id', jobConfig.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `News import job ran successfully`,
        details: {
          articles_found: newsData.articles.length,
          articles_inserted: insertedCount,
          execution_time: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error in run-news-import function:", error);
    
    // Create a Supabase client to log the error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      );
      
      // Log error to a job_logs table if available
      await supabase
        .from('job_logs')
        .insert([{
          job_name: 'news_import',
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          execution_time: new Date().toISOString(),
          details: error.stack || null
        }])
        .catch(() => {
          // Silently fail if job_logs table doesn't exist
          console.log("Note: Could not log to job_logs table");
        });
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
