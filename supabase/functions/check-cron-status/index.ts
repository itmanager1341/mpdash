
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // First check for news_import job (new naming convention)
    const { data: newsImportJobSettings, error: newsImportError } = await supabase
      .from('scheduled_job_settings')
      .select('*')
      .eq('job_name', 'news_import')
      .maybeSingle();
    
    // If not found, check for daily-perplexity-news-fetch job (old naming convention)
    const { data: perplexityJobSettings, error: perplexityError } = await supabase
      .from('scheduled_job_settings')
      .select('*')
      .eq('job_name', 'daily-perplexity-news-fetch')
      .maybeSingle();
    
    // Use whichever job settings we found
    const jobSettings = newsImportJobSettings || perplexityJobSettings;
    
    if (newsImportError && perplexityError) {
      console.error("Error fetching job settings:", newsImportError, perplexityError);
    }

    // Check recent job logs
    const { data: recentLogs, error: logsError } = await supabase
      .from('job_logs')
      .select('*')
      .or(`job_name.eq.news_import,job_name.eq.daily-perplexity-news-fetch`)
      .order('execution_time', { ascending: false })
      .limit(5);
    
    if (logsError) {
      console.error("Error fetching job logs:", logsError);
    }

    // Try to get cron job status using the get_cron_jobs function
    let cronJobStatus = null;
    try {
      const { data: cronData, error: cronError } = await supabase
        .rpc('get_cron_jobs');
      
      if (!cronError && cronData) {
        cronJobStatus = cronData;
      } else {
        console.error("Error getting cron jobs:", cronError);
      }
    } catch (e) {
      console.log("Could not fetch cron status via RPC:", e.message);
    }

    // Check if Perplexity API key is configured
    let perplexityApiConfigured = false;
    try {
      const { data: apiKeys, error: apiKeysError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('service', 'perplexity')
        .eq('is_active', true)
        .limit(1);
        
      perplexityApiConfigured = !apiKeysError && Array.isArray(apiKeys) && apiKeys.length > 0;
    } catch (apiCheckError) {
      console.error("Error checking Perplexity API key:", apiCheckError);
    }

    // Check Edge function environment for PERPLEXITY_API_KEY
    const perplexityApiKeyInEnv = !!Deno.env.get('PERPLEXITY_API_KEY');

    return new Response(
      JSON.stringify({
        success: true,
        job_settings: jobSettings,
        recent_logs: recentLogs || [],
        cron_status: cronJobStatus,
        current_time: new Date().toISOString(),
        api_keys: {
          perplexity_api_key_in_db: perplexityApiConfigured,
          perplexity_api_key_in_env: perplexityApiKeyInEnv
        },
        recommendations: {
          job_exists: !!jobSettings,
          job_enabled: jobSettings?.is_enabled || false,
          has_recent_runs: (recentLogs?.length || 0) > 0,
          last_run: jobSettings?.last_run || null,
          model_suggestions: {
            recommended_model: "llama-3.1-sonar-small-128k-online",
            deprecated_models: [
              "perplexity/sonar-small-online", 
              "perplexity/sonar-medium-online"
            ],
            current_model: jobSettings?.parameters?.model || "unknown"
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error checking cron status:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        current_time: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
