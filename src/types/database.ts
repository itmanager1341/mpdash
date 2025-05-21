
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

// Define user roles
export type AppRole = 'admin' | 'editor' | 'writer' | 'viewer';

// Interface for user profile
export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Interface for user roles
export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
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
