
-- Fix for previously failed migration:

-- First make sure extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create or replace function to manage cron job
CREATE OR REPLACE FUNCTION update_news_fetch_job(
  p_job_name TEXT,
  p_schedule TEXT,
  p_is_enabled BOOLEAN,
  p_parameters JSONB
) RETURNS TEXT AS $$
DECLARE
  job_id INTEGER;
  result TEXT;
BEGIN
  -- Try to unschedule any existing job first
  PERFORM cron.unschedule(p_job_name);

  -- If job should be enabled, schedule it with new parameters
  IF p_is_enabled THEN
    job_id := cron.schedule(
      p_job_name,
      p_schedule,
      format(
        $job$
        SELECT net.http_post(
          url:='https://grebpkcwmurbxorodiyb.supabase.co/functions/v1/fetch-perplexity-news',
          headers:='{
            "Content-Type": "application/json",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZWJwa2N3bXVyYnhvcm9kaXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyODg5NzcsImV4cCI6MjA2MTg2NDk3N30.HuJWb1GhJrSD5vqeBhOn6lxcqPN9B4oX-eu1nJvsc68"
          }'::jsonb,
          body:='%s'::jsonb
        ) AS request_id;
        $job$,
        p_parameters
      )
    );
    result := 'Job scheduled with ID: ' || job_id;
  ELSE
    result := 'Job unscheduled successfully';
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a table to store cron job settings if it doesn't exist already
CREATE TABLE IF NOT EXISTS public.scheduled_job_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  schedule TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert initial settings record for the news fetch job if doesn't exist
INSERT INTO public.scheduled_job_settings (job_name, schedule, parameters)
VALUES (
  'daily-perplexity-news-fetch', 
  '0 6 * * *',
  '{
    "minScore": 2.5,
    "keywords": ["mortgage", "housing market", "federal reserve", "interest rates", "foreclosure", "home equity"],
    "limit": 20
  }'::jsonb
)
ON CONFLICT (job_name) DO UPDATE SET
  updated_at = now();

-- Create or replace function to get job settings
CREATE OR REPLACE FUNCTION get_job_settings(job_name_param TEXT)
RETURNS SETOF scheduled_job_settings AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM scheduled_job_settings WHERE job_name = job_name_param;
END;
$$ LANGUAGE plpgsql;

-- Create or replace function to update job settings
CREATE OR REPLACE FUNCTION update_job_settings(job_name_param TEXT, settings_json JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE scheduled_job_settings
  SET 
    is_enabled = COALESCE(settings_json->>'is_enabled', is_enabled::text)::boolean,
    schedule = COALESCE(settings_json->>'schedule', schedule),
    parameters = COALESCE(settings_json->'parameters', parameters),
    updated_at = now()
  WHERE job_name = job_name_param;
  
  -- Call the function to update the actual cron job
  PERFORM update_news_fetch_job(
    job_name_param,
    (SELECT schedule FROM scheduled_job_settings WHERE job_name = job_name_param),
    (SELECT is_enabled FROM scheduled_job_settings WHERE job_name = job_name_param),
    (SELECT parameters FROM scheduled_job_settings WHERE job_name = job_name_param)
  );
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to call our job updater
CREATE OR REPLACE FUNCTION process_job_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_news_fetch_job(
    NEW.job_name,
    NEW.schedule,
    NEW.is_enabled,
    NEW.parameters
  );
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace trigger
DROP TRIGGER IF EXISTS update_job_settings_trigger ON scheduled_job_settings;
CREATE TRIGGER update_job_settings_trigger
AFTER INSERT OR UPDATE OF is_enabled, schedule, parameters ON scheduled_job_settings
FOR EACH ROW
EXECUTE FUNCTION process_job_settings_change();

-- Initialize the job with current settings
SELECT update_news_fetch_job(
  job_name,
  schedule,
  is_enabled,
  parameters
) FROM scheduled_job_settings
WHERE job_name = 'daily-perplexity-news-fetch';
