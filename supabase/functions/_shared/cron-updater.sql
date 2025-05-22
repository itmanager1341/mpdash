
-- Create job logging table if not exists
CREATE TABLE IF NOT EXISTS job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  execution_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add last_run_result column to scheduled_job_settings if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'scheduled_job_settings' AND column_name = 'last_run_result'
  ) THEN
    ALTER TABLE scheduled_job_settings ADD COLUMN last_run_result JSONB;
  END IF;
END
$$;

-- Function to update scheduled jobs with proper error handling
CREATE OR REPLACE FUNCTION update_scheduled_job(
  job_name_param TEXT,
  schedule_param TEXT,
  is_enabled_param BOOLEAN,
  call_function_name_param TEXT,
  parameters_param JSONB
) RETURNS TEXT AS $$
DECLARE
  job_exists BOOLEAN;
  pg_job_exists BOOLEAN;
  result_message TEXT;
BEGIN
  -- Check if job exists in our settings table
  SELECT EXISTS(
    SELECT 1 FROM scheduled_job_settings WHERE job_name = job_name_param
  ) INTO job_exists;
  
  -- Check if job exists in pg_cron
  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname = job_name_param
  ) INTO pg_job_exists;
  
  -- Unschedule existing job in pg_cron
  IF pg_job_exists THEN
    PERFORM cron.unschedule(job_name_param);
  END IF;
  
  -- Update or insert job in settings table
  IF job_exists THEN
    UPDATE scheduled_job_settings
    SET 
      schedule = schedule_param,
      is_enabled = is_enabled_param,
      parameters = parameters_param,
      updated_at = now()
    WHERE job_name = job_name_param;
  ELSE
    INSERT INTO scheduled_job_settings (
      job_name, 
      schedule, 
      is_enabled, 
      parameters,
      created_at,
      updated_at
    ) VALUES (
      job_name_param,
      schedule_param,
      is_enabled_param,
      parameters_param,
      now(),
      now()
    );
  END IF;
  
  -- Schedule new job if enabled
  IF is_enabled_param THEN
    -- Format the body as a JSON with the function name
    PERFORM cron.schedule(
      job_name_param,
      schedule_param,
      format(
        $job$
        SELECT net.http_post(
          url:='%s',
          headers:='{
            "Content-Type": "application/json",
            "Authorization": "Bearer %s"
          }'::jsonb,
          body:='{"execution_source": "pg_cron"}'::jsonb
        ) AS request_id;
        $job$,
        'https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/' || call_function_name_param,
        (SELECT current_setting('supabase.anon_key'))
      )
    );
    
    result_message := 'Job scheduled successfully with cron: ' || schedule_param;
  ELSE
    result_message := 'Job unscheduled successfully';
  END IF;
  
  -- Log the operation
  INSERT INTO job_logs (
    job_name, 
    status, 
    message
  ) VALUES (
    job_name_param,
    'configuration',
    result_message
  );
  
  RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- Setup news import job if not exists
SELECT update_scheduled_job(
  'news_import',
  '0 7,15 * * *', -- 7am and 3pm daily
  true,
  'run-news-import',
  '{
    "minScore": 0.6,
    "limit": 20,
    "keywords": ["mortgage rates", "housing market", "federal reserve", "interest rates", "home equity", "foreclosure"]
  }'::jsonb
) WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_job_settings WHERE job_name = 'news_import'
);
