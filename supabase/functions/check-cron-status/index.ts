
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

    // Check the current job settings
    const { data: jobSettings, error: jobError } = await supabase
      .from('scheduled_job_settings')
      .select('*')
      .eq('job_name', 'news_import')
      .maybeSingle();
    
    if (jobError) {
      console.error("Error fetching job settings:", jobError);
    }

    // Check recent job logs
    const { data: recentLogs, error: logsError } = await supabase
      .from('job_logs')
      .select('*')
      .eq('job_name', 'news_import')
      .order('execution_time', { ascending: false })
      .limit(5);
    
    if (logsError) {
      console.error("Error fetching job logs:", logsError);
    }

    // Try to get cron job status using RPC if available
    let cronJobStatus = null;
    try {
      const { data: cronData, error: cronError } = await supabase
        .rpc('get_job_settings', { job_name_param: 'news_import' });
      
      if (!cronError && cronData) {
        cronJobStatus = cronData;
      }
    } catch (e) {
      console.log("Could not fetch cron status via RPC:", e.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_settings: jobSettings,
        recent_logs: recentLogs || [],
        cron_status: cronJobStatus,
        current_time: new Date().toISOString(),
        recommendations: {
          job_exists: !!jobSettings,
          job_enabled: jobSettings?.is_enabled || false,
          has_recent_runs: (recentLogs?.length || 0) > 0,
          last_run: jobSettings?.last_run || null
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
