
-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.get_cron_jobs();

-- Create a new version that doesn't depend on the last_run column
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
    END IF;
  END IF;
  -- Return empty result set if pg_cron is not available or table doesn't exist
  RETURN;
END;
$$;
