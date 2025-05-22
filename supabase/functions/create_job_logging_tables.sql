
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

-- Create an index on job_name and execution_time for faster queries
CREATE INDEX IF NOT EXISTS job_logs_job_name_execution_time_idx ON job_logs (job_name, execution_time DESC);

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

-- Ensure the scheduled_job_settings table exists
CREATE TABLE IF NOT EXISTS scheduled_job_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  schedule TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run TIMESTAMPTZ,
  last_run_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to log job events
CREATE OR REPLACE FUNCTION log_job_event(
  job_name_param TEXT,
  status_param TEXT,
  message_param TEXT DEFAULT NULL,
  details_param JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO job_logs (
    job_name,
    status,
    message,
    details
  ) VALUES (
    job_name_param,
    status_param,
    message_param,
    details_param
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update job status
CREATE OR REPLACE FUNCTION update_job_status(
  job_name_param TEXT,
  last_run_param TIMESTAMPTZ DEFAULT now(),
  result_param JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  job_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM scheduled_job_settings WHERE job_name = job_name_param
  ) INTO job_exists;
  
  IF job_exists THEN
    UPDATE scheduled_job_settings
    SET 
      last_run = last_run_param,
      last_run_result = result_param,
      updated_at = now()
    WHERE job_name = job_name_param;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Ensure news_import job exists
INSERT INTO scheduled_job_settings (
  job_name,
  schedule,
  is_enabled,
  parameters
)
VALUES (
  'news_import',
  '0 */12 * * *',
  true,
  '{
    "minScore": 0.6,
    "limit": 20,
    "keywords": ["mortgage rates", "housing market", "federal reserve", "interest rates", "home equity", "foreclosure"]
  }'::jsonb
)
ON CONFLICT (job_name) 
DO NOTHING;

-- Create a function to retrieve recent job logs
CREATE OR REPLACE FUNCTION get_recent_job_logs(
  job_name_param TEXT DEFAULT NULL,
  limit_param INT DEFAULT 100
) 
RETURNS SETOF job_logs AS $$
BEGIN
  IF job_name_param IS NULL THEN
    RETURN QUERY
    SELECT * FROM job_logs
    ORDER BY execution_time DESC
    LIMIT limit_param;
  ELSE
    RETURN QUERY
    SELECT * FROM job_logs
    WHERE job_name = job_name_param
    ORDER BY execution_time DESC
    LIMIT limit_param;
  END IF;
END;
$$ LANGUAGE plpgsql;
