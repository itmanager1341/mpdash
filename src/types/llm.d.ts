
interface LlmPrompt {
  id: string;
  function_name: string;
  model: string;
  prompt_text: string;
  include_clusters: boolean;
  include_tracking_summary: boolean;
  include_sources_map: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_updated_by: string | null;
}

interface LlmPromptFormData {
  function_name: string;
  model: string;
  prompt_text: string;
  include_clusters: boolean;
  include_tracking_summary: boolean;
  include_sources_map: boolean;
  is_active: boolean;
}

interface LlmTestInput {
  prompt_id?: string;
  function_name?: string;
  prompt_text: string;
  model: string;
  input_data: Record<string, any>;
  include_clusters: boolean;
  include_tracking_summary: boolean;
  include_sources_map: boolean;
}

interface LlmTestResult {
  output: any;
  raw_response?: any;
  timing?: {
    total_ms: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  model_used: string;
  error?: string;
}

interface KeywordSuggestion {
  keyword: string;
  score: number;
  source: string;
  status: "pending" | "approved" | "dismissed";
  rationale?: string;
  related_clusters?: string[];
}

interface PromptMetadata {
  search_settings: {
    domain_filter: string;
    recency_filter: string;
    temperature: number;
    max_tokens: number;
    is_news_search: boolean;
    selected_themes?: {
      primary: string[];
      sub: string[];
      professions: string[];
    };
  };
}

// Enhanced Model interface with cost and performance information
interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  maxTokens: number;
  isAvailable: boolean;
  defaultSettings: Record<string, any>;
  costPer1MTokens?: {
    input: number;
    output: number;
  };
  avgResponseTime?: string;
  recommendedFor?: string[];
}
