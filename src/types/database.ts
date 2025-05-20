
// Type definitions for custom Supabase functions and tables
import { Json } from "@/integrations/supabase/types";

// Type for the scheduled job settings table
export interface ScheduledJobSettings {
  id: string;
  job_name: string;
  is_enabled: boolean;
  schedule: string;
  parameters: {
    minScore: number;
    keywords: string[];
    limit: number;
  };
  last_run: string | null;
  created_at: string;
  updated_at: string;
}

// Define custom RPC function return types
export interface SupabaseRpcFunctions {
  get_job_settings: ScheduledJobSettings;
  update_job_settings: boolean;
  get_approval_stats: {
    approval_date: string;
    mpdaily_count: number;
    magazine_count: number;
    website_count: number;
    dismissed_count: number;
    total_reviewed: number;
  };
}
