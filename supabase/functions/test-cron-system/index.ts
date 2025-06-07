
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
        // Check what cron jobs exist using the improved function
        const { data: cronJobs, error: cronError } = await supabase.rpc('get_cron_jobs');
        result.cronJobs = cronJobs;
        result.cronError = cronError;
        console.log('Cron jobs check:', { cronJobs, cronError });
        break;

      case 'check_job_settings':
        // Check scheduled job settings
        const { data: jobSettings, error: settingsError } = await supabase
          .from('scheduled_job_settings')
          .select('*')
          .order('created_at', { ascending: false });
        result.jobSettings = jobSettings;
        result.settingsError = settingsError;
        console.log('Job settings check:', { jobSettings, settingsError });
        break;

      case 'remove_legacy_job':
        if (!jobName) {
          throw new Error('Job name is required for removal');
        }
        try {
          // Use the existing update_news_fetch_job function to properly remove the job
          const { data: removeResult, error: removeError } = await supabase.rpc('update_news_fetch_job', {
            p_job_name: jobName,
            p_schedule: '0 0 1 1 *', // Dummy schedule (won't be used since disabled)
            p_is_enabled: false,
            p_parameters: {}
          });
          
          if (removeError) {
            console.error('Error removing legacy job:', removeError);
            result.removeError = removeError.message;
          } else {
            result.removeResult = `Successfully removed legacy job: ${jobName}`;
            console.log('Successfully removed legacy job:', jobName);
          }
        } catch (error) {
          console.error('Exception removing legacy job:', error);
          result.removeError = error.message;
        }
        break;

      case 'reactivate_job':
        if (!jobName) {
          throw new Error('Job name is required for reactivation');
        }
        
        try {
          // Use the new improved reactivate_scheduled_job function
          const { data: reactivateResult, error: reactivateError } = await supabase.rpc('reactivate_scheduled_job', {
            job_name_param: jobName
          });
          
          if (reactivateError) {
            console.error('Error reactivating job:', reactivateError);
            result.reactivateError = reactivateError;
          } else {
            result.reactivateResult = reactivateResult || `Job reactivated: ${jobName}`;
            console.log('Successfully reactivated job:', jobName, reactivateResult);
          }
        } catch (error) {
          console.error('Exception reactivating job:', error);
          result.reactivateError = { message: error.message };
        }
        break;

      case 'test_trigger':
        if (!jobName) {
          throw new Error('Job name is required for trigger test');
        }
        try {
          // Test the trigger by updating a job
          const { data: triggerTest, error: triggerError } = await supabase
            .from('scheduled_job_settings')
            .update({ updated_at: new Date().toISOString() })
            .eq('job_name', jobName);
          result.triggerTest = triggerTest;
          result.triggerError = triggerError;
          console.log('Trigger test result:', { triggerTest, triggerError });
        } catch (error) {
          console.error('Exception testing trigger:', error);
          result.triggerError = { message: error.message };
        }
        break;

      case 'full_diagnostic':
        // Get comprehensive diagnostic info
        const { data: allCronJobs, error: cronErr } = await supabase.rpc('get_cron_jobs');
        const { data: allJobSettings, error: settingsErr } = await supabase
          .from('scheduled_job_settings')
          .select('*');
        const { data: recentLogs, error: logsErr } = await supabase
          .from('job_execution_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        result = {
          cronJobs: allCronJobs || [],
          jobSettings: allJobSettings || [],
          recentLogs: recentLogs || [],
          timestamp: new Date().toISOString(),
          errors: {
            cronErr,
            settingsErr,
            logsErr
          }
        };
        
        console.log('Full diagnostic completed:', {
          cronJobsCount: allCronJobs?.length || 0,
          jobSettingsCount: allJobSettings?.length || 0,
          recentLogsCount: recentLogs?.length || 0,
          errors: { cronErr, settingsErr, logsErr }
        });
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
