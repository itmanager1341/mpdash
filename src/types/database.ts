// Type definitions for custom Supabase functions and tables
import { Json } from "@/integrations/supabase/types";
import { DateRange } from "react-day-picker";

// Type for the scheduled job settings table
export interface ScheduledJobSettings {
  id: string;
  job_name: string;
  is_enabled: boolean;
  schedule: string;
  parameters: Json; // Changed from specific shape to Json type for flexibility
  last_run: string | null;
  created_at: string;
  updated_at: string;
}

// Define user roles - matches the app_role enum in the database
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

// Interface for user roles - matches the user_roles table
export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

// Interface for content chunks
export interface ContentChunk {
  id: string;
  article_id: string;
  chunk_index: number;
  content: string;
  word_count: number;
  chunk_type: 'title' | 'content' | 'summary';
  embedding: number[] | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Interface for search results
export interface SearchResult {
  id: string;
  article_id: string;
  content: string;
  word_count: number;
  chunk_type: string;
  similarity: number;
  rank: number;
  article_title: string;
  article_status: string;
}

// Interface for grouped search results
export interface GroupedSearchResult {
  article_id: string;
  article_title: string;
  article_status: string;
  chunks: Omit<SearchResult, 'article_title' | 'article_status' | 'article_id'>[];
  max_rank: number;
}

// Interface for LLM model configuration
export interface LlmModelConfig {
  id: string;
  model_id: string;
  provider: string;
  parameters: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    include_clusters?: boolean;
    include_tracking_summary?: boolean;
    include_sources_map?: boolean;
  };
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

// Interface for LLM usage logs
export interface LlmUsageLog {
  id: string;
  function_name: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
  user_id: string | null;
  operation_metadata: Record<string, any>;
  created_at: string;
}

// Interface for usage analytics
export interface UsageAnalytics {
  totalTokens: number;
  totalCost: number;
  operationCount: number;
  averageDuration: number;
  successRate: number;
  functionBreakdown: Array<{
    function_name: string;
    tokens: number;
    cost: number;
    operations: number;
  }>;
  modelBreakdown: Array<{
    model: string;
    tokens: number;
    cost: number;
    operations: number;
  }>;
  dailyUsage: Array<{
    date: string;
    tokens: number;
    cost: number;
    operations: number;
  }>;
}

// Interface for keyword clusters
export interface KeywordCluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  description?: string;
  keywords?: string[];
  professions?: string[];
  created_at: string;
}

// Interface for keyword suggestions
export interface KeywordSuggestion {
  id?: string;
  keyword: string;
  score: number;
  related_clusters: string[];
  source: string;
  rationale?: string;
  status?: 'pending' | 'approved' | 'dismissed';
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

// Interface for article metrics
export interface ArticleMetrics {
  id: string;
  article_id: string;
  page_views: number;
  time_on_page: number | null;
  bounce_rate: number | null;
  comments_count: number;
  seo_score: number | null;
  readability_score: number | null;
  social_shares: number;
  wordpress_stats: Json;
  metric_type: string;
  recorded_at: string;
  created_at: string;
}

// Interface for article AI analysis
export interface ArticleAiAnalysis {
  id: string;
  article_id: string;
  analysis_version: number;
  ai_model_used: string;
  content_quality_score: number | null;
  template_classification: string | null;
  extracted_keywords: Json;
  matched_clusters: Json;
  performance_prediction: Json;
  analysis_data: Json;
  analyzed_at: string;
  created_at: string;
}

// Interface for WordPress author mapping
export interface WordPressAuthorMapping {
  id: string;
  wordpress_author_id: number;
  wordpress_author_name: string;
  system_author_id: string | null;
  mapping_confidence: number | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// Extended interface for articles with WordPress fields
export interface ArticleWithWordPress {
  id: string;
  title: string;
  content_variants: Json | null;
  status: string | null;
  wordpress_id: number | null;
  wordpress_author_id: number | null;
  wordpress_author_name: string | null;
  wordpress_categories: Json;
  wordpress_tags: Json;
  last_wordpress_sync: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// Extended interface for news with publication tracking
export interface NewsWithPublication {
  id: string;
  headline: string;
  summary: string | null;
  publication_status: string;
  published_article_id: string | null;
  publication_confidence_score: number | null;
  timestamp: string;
  source: string | null;
  url: string;
  status: string | null;
}
