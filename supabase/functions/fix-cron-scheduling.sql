
-- Fix the get_cron_jobs function to handle missing columns gracefully
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE(
  jobid INTEGER,
  jobname TEXT,
  schedule TEXT,
  command TEXT,
  nodename TEXT,
  nodeport INTEGER,
  database TEXT,
  username TEXT,
  active BOOLEAN,
  next_run TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if pg_cron is installed and accessible
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Return records from cron.job if it exists
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'cron' AND c.relname = 'job'
    ) THEN
      -- Check if next_run column exists, if not use NULL
      IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'cron' 
          AND c.relname = 'job'
          AND a.attname = 'next_run'
      ) THEN
        RETURN QUERY
        SELECT 
          j.jobid,
          j.jobname,
          j.schedule,
          j.command,
          j.nodename,
          j.nodeport,
          j.database,
          j.username,
          j.active,
          j.next_run
        FROM cron.job j;
      ELSE
        -- If next_run doesn't exist, use NULL for that column
        RETURN QUERY
        SELECT 
          j.jobid,
          j.jobname,
          j.schedule,
          j.command,
          j.nodename,
          j.nodeport,
          j.database,
          j.username,
          j.active,
          NULL::TIMESTAMP WITH TIME ZONE as next_run
        FROM cron.job j;
      END IF;
    END IF;
  END IF;
  -- Return empty result set if pg_cron is not available or table doesn't exist
  RETURN;
END;
$$;

-- Fix the update_news_fetch_job function to properly create cron jobs
CREATE OR REPLACE FUNCTION public.update_news_fetch_job(
  p_job_name TEXT,
  p_schedule TEXT,
  p_is_enabled BOOLEAN,
  p_parameters JSONB
) RETURNS TEXT AS $$
DECLARE
  job_id INTEGER;
  result TEXT;
  function_url TEXT;
  auth_header TEXT;
  job_body JSONB;
BEGIN
  -- Log the function call for debugging
  RAISE NOTICE 'update_news_fetch_job called with: %, %, %, %', p_job_name, p_schedule, p_is_enabled, p_parameters;
  
  -- Try to unschedule any existing job first
  BEGIN
    PERFORM cron.unschedule(p_job_name);
    RAISE NOTICE 'Unscheduled existing job: %', p_job_name;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing job to unschedule or error: %', SQLERRM;
  END;

  -- If job should be enabled, schedule it with new parameters
  IF p_is_enabled THEN
    -- Use the correct function URL
    function_url := 'https://grebpkcwmurbxorodiyb.supabase.co/functions/v1/run-news-import';
    
    -- Build the request body
    job_body := jsonb_build_object(
      'manual', false,
      'promptId', p_parameters->>'promptId',
      'modelOverride', p_parameters->>'model',
      'limit', COALESCE((p_parameters->>'limit')::integer, 20),
      'triggeredBy', 'cron_job'
    );
    
    RAISE NOTICE 'Scheduling job with body: %', job_body;
    
    BEGIN
      job_id := cron.schedule(
        p_job_name,
        p_schedule,
        format(
          $job$
          SELECT net.http_post(
            url:='%s',
            headers:='{
              "Content-Type": "application/json",
              "Authorization": "Bearer %s"
            }'::jsonb,
            body:='%s'::jsonb
          ) AS request_id;
          $job$,
          function_url,
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZWJwa2N3bXVyYnhvcm9kaXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyODg5NzcsImV4cCI6MjA2MTg2NDk3N30.HuJWb1GhJrSD5vqeBhOn6lxcqPN9B4oX-eu1nJvsc68',
          job_body
        )
      );
      
      result := 'Job scheduled successfully with ID: ' || job_id;
      RAISE NOTICE 'Job scheduled successfully with ID: %', job_id;
      
    EXCEPTION WHEN OTHERS THEN
      result := 'Error scheduling job: ' || SQLERRM;
      RAISE NOTICE 'Error scheduling job: %', SQLERRM;
    END;
  ELSE
    result := 'Job unscheduled successfully';
    RAISE NOTICE 'Job unscheduled: %', p_job_name;
  END IF;
  
  -- Log the operation in job_execution_logs for tracking
  INSERT INTO public.job_execution_logs (
    job_name, 
    execution_type,
    status, 
    message,
    details
  ) VALUES (
    p_job_name,
    'configuration',
    'success',
    result,
    jsonb_build_object(
      'schedule', p_schedule,
      'enabled', p_is_enabled,
      'parameters', p_parameters
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.process_job_settings_change()
RETURNS TRIGGER AS $$
DECLARE
  result_msg TEXT;
BEGIN
  RAISE NOTICE 'Trigger fired for job: %, enabled: %', NEW.job_name, NEW.is_enabled;
  
  BEGIN
    -- Call the updated job management function
    SELECT update_news_fetch_job(
      NEW.job_name,
      NEW.schedule,
      NEW.is_enabled,
      NEW.parameters
    ) INTO result_msg;
    
    RAISE NOTICE 'Trigger result: %', result_msg;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Trigger error: %', SQLERRM;
    -- Don't fail the entire transaction, just log the error
  END;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger to ensure it's working
DROP TRIGGER IF EXISTS update_job_settings_trigger ON scheduled_job_settings;
CREATE TRIGGER update_job_settings_trigger
  AFTER INSERT OR UPDATE OF is_enabled, schedule, parameters ON scheduled_job_settings
  FOR EACH ROW
  EXECUTE FUNCTION process_job_settings_change();

-- Function to manually re-activate a job (for fixing existing broken jobs)
CREATE OR REPLACE FUNCTION public.reactivate_scheduled_job(job_name_param TEXT)
RETURNS TEXT AS $$
DECLARE
  job_settings RECORD;
  result_msg TEXT;
BEGIN
  -- Get the job settings
  SELECT * INTO job_settings 
  FROM scheduled_job_settings 
  WHERE job_name = job_name_param;
  
  IF NOT FOUND THEN
    RETURN 'Job not found: ' || job_name_param;
  END IF;
  
  -- Force re-creation of the cron job
  SELECT update_news_fetch_job(
    job_settings.job_name,
    job_settings.schedule,
    job_settings.is_enabled,
    job_settings.parameters
  ) INTO result_msg;
  
  -- Update the job settings to trigger any dependent processes
  UPDATE scheduled_job_settings 
  SET updated_at = now()
  WHERE job_name = job_name_param;
  
  RETURN 'Reactivated job: ' || job_name_param || ' - ' || result_msg;
END;
$$ LANGUAGE plpgsql;
