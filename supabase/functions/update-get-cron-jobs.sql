
-- Update the get_cron_jobs function to properly check for column existence
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
      -- Check which columns actually exist in the cron.job table
      IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'cron' 
          AND c.relname = 'job'
          AND a.attname = 'last_run'
      ) THEN
        -- If last_run exists, include it in the query
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
        -- If last_run doesn't exist, exclude it from the query
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
  END IF;
  -- Return empty result set if pg_cron is not available or table doesn't exist
  RETURN;
END;
$$;
