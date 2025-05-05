
-- Add content_variants column to news table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'news' 
                   AND column_name = 'content_variants') THEN
        ALTER TABLE public.news ADD COLUMN content_variants JSONB;
    END IF;
END
$$;

-- Update or insert function to get approval stats by date
CREATE OR REPLACE FUNCTION get_approval_stats(start_date DATE, end_date DATE)
RETURNS TABLE (
    approval_date DATE,
    mpdaily_count BIGINT,
    magazine_count BIGINT,
    website_count BIGINT,
    dismissed_count BIGINT,
    total_reviewed BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH date_range AS (
        SELECT generate_series(start_date, end_date, '1 day'::interval)::date as date
    ),
    status_counts AS (
        SELECT 
            date_trunc('day', timestamp)::date as day,
            COUNT(*) FILTER (WHERE status = 'approved_mpdaily' OR status = 'drafted_mpdaily' OR status = 'published_mpdaily') as mpdaily,
            COUNT(*) FILTER (WHERE status = 'approved_magazine' OR status = 'drafted_magazine' OR status = 'published_magazine') as magazine,
            COUNT(*) FILTER (WHERE status = 'approved_website' OR status = 'drafted_website' OR status = 'published_website') as website,
            COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed,
            COUNT(*) FILTER (WHERE status IS NOT NULL) as total
        FROM news
        WHERE timestamp::date BETWEEN start_date AND end_date
        GROUP BY day
    )
    SELECT 
        d.date as approval_date,
        COALESCE(sc.mpdaily, 0) as mpdaily_count,
        COALESCE(sc.magazine, 0) as magazine_count,
        COALESCE(sc.website, 0) as website_count,
        COALESCE(sc.dismissed, 0) as dismissed_count,
        COALESCE(sc.total, 0) as total_reviewed
    FROM date_range d
    LEFT JOIN status_counts sc ON d.date = sc.day
    ORDER BY d.date;
END;
$$ LANGUAGE plpgsql;
