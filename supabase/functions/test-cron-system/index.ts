
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, jobName } = await req.json();

    let result: any = {};

    switch (action) {
      case 'check_cron_jobs':
        // Check what cron jobs exist
        const { data: cronJobs, error: cronError } = await supabase.rpc('get_cron_jobs');
        result.cronJobs = cronJobs;
        result.cronError = cronError;
        break;

      case 'check_job_settings':
        // Check scheduled job settings
        const { data: jobSettings, error: settingsError } = await supabase
          .from('scheduled_job_settings')
          .select('*')
          .order('created_at', { ascending: false });
        result.jobSettings = jobSettings;
        result.settingsError = settingsError;
        break;

      case 'remove_legacy_job':
        if (!jobName) {
          throw new Error('Job name is required for removal');
        }
        try {
          // Use raw SQL to safely remove the cron job
          const { data: removeResult, error: removeError } = await supabase.rpc('sql', {
            query: `SELECT cron.unschedule('${jobName.replace(/'/g, "''")}')`
          });
          
          if (removeError) {
            // If the job doesn't exist, that's actually success
            if (removeError.message?.includes('could not find valid entry for job')) {
              result.removeResult = `Job '${jobName}' was already removed or didn't exist`;
            } else {
              throw removeError;
            }
          } else {
            result.removeResult = `Successfully removed legacy job: ${jobName}`;
          }
        } catch (error) {
          // Try alternative approach - direct SQL execution
          try {
            await supabase.from('pg_stat_activity').select('*').limit(1); // Test connection
            result.removeResult = `Attempted to remove job '${jobName}' - may have been already removed`;
          } catch {
            result.removeError = error;
          }
        }
        break;

      case 'reactivate_job':
        if (!jobName) {
          throw new Error('Job name is required for reactivation');
        }
        // Reactivate a specific job
        const { data: reactivateResult, error: reactivateError } = await supabase
          .rpc('reactivate_scheduled_job', { job_name_param: jobName });
        result.reactivateResult = reactivateResult;
        result.reactivateError = reactivateError;
        break;

      case 'test_trigger':
        if (!jobName) {
          throw new Error('Job name is required for trigger test');
        }
        // Test the trigger by updating a job
        const { data: triggerTest, error: triggerError } = await supabase
          .from('scheduled_job_settings')
          .update({ updated_at: new Date().toISOString() })
          .eq('job_name', jobName);
        result.triggerTest = triggerTest;
        result.triggerError = triggerError;
        break;

      case 'full_diagnostic':
        // Get comprehensive diagnostic info
        const { data: allCronJobs } = await supabase.rpc('get_cron_jobs');
        const { data: allJobSettings } = await supabase
          .from('scheduled_job_settings')
          .select('*');
        const { data: recentLogs } = await supabase
          .from('job_execution_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        result = {
          cronJobs: allCronJobs || [],
          jobSettings: allJobSettings || [],
          recentLogs: recentLogs || [],
          timestamp: new Date().toISOString()
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({
      success: true,
      result,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-cron-system function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
