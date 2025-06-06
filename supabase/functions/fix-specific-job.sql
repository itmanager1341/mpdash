
-- Fix the specific job that's not running by reactivating it
SELECT reactivate_scheduled_job('news_search_daily_news_search1');

-- Also check current cron jobs to verify it was created
SELECT * FROM get_cron_jobs() WHERE jobname LIKE '%news_search%';

-- Show the job settings for verification
SELECT job_name, is_enabled, schedule, parameters, last_run, updated_at 
FROM scheduled_job_settings 
WHERE job_name = 'news_search_daily_news_search1';
