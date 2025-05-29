export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_masked: string
          name: string
          secret_stored: boolean
          service: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_masked: string
          name: string
          secret_stored?: boolean
          service: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_masked?: string
          name?: string
          secret_stored?: boolean
          service?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          byline_text: string | null
          co_authors: string[] | null
          content_complexity_score: number | null
          content_variants: Json | null
          created_at: string | null
          destinations: string[] | null
          editor_brief_id: string | null
          embedding: string | null
          fred_data: Json | null
          id: string
          linked_prior_articles: string[] | null
          primary_author_id: string | null
          publication_targets: string[] | null
          published_at: string | null
          related_trends: string[] | null
          source_attribution: string | null
          source_news_id: string | null
          source_system: string | null
          status: string | null
          template_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          byline_text?: string | null
          co_authors?: string[] | null
          content_complexity_score?: number | null
          content_variants?: Json | null
          created_at?: string | null
          destinations?: string[] | null
          editor_brief_id?: string | null
          embedding?: string | null
          fred_data?: Json | null
          id?: string
          linked_prior_articles?: string[] | null
          primary_author_id?: string | null
          publication_targets?: string[] | null
          published_at?: string | null
          related_trends?: string[] | null
          source_attribution?: string | null
          source_news_id?: string | null
          source_system?: string | null
          status?: string | null
          template_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          byline_text?: string | null
          co_authors?: string[] | null
          content_complexity_score?: number | null
          content_variants?: Json | null
          created_at?: string | null
          destinations?: string[] | null
          editor_brief_id?: string | null
          embedding?: string | null
          fred_data?: Json | null
          id?: string
          linked_prior_articles?: string[] | null
          primary_author_id?: string | null
          publication_targets?: string[] | null
          published_at?: string | null
          related_trends?: string[] | null
          source_attribution?: string | null
          source_news_id?: string | null
          source_system?: string | null
          status?: string | null
          template_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_primary_author_id_fkey"
            columns: ["primary_author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_source_news_id_fkey"
            columns: ["source_news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          article_count: number | null
          author_type: string
          average_rating: number | null
          bio: string | null
          created_at: string
          email: string | null
          expertise_areas: string[] | null
          first_published_date: string | null
          id: string
          is_active: boolean
          last_published_date: string | null
          name: string
          photo_url: string | null
          social_links: Json | null
          total_views: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          article_count?: number | null
          author_type: string
          average_rating?: number | null
          bio?: string | null
          created_at?: string
          email?: string | null
          expertise_areas?: string[] | null
          first_published_date?: string | null
          id?: string
          is_active?: boolean
          last_published_date?: string | null
          name: string
          photo_url?: string | null
          social_links?: Json | null
          total_views?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          article_count?: number | null
          author_type?: string
          average_rating?: number | null
          bio?: string | null
          created_at?: string
          email?: string | null
          expertise_areas?: string[] | null
          first_published_date?: string | null
          id?: string
          is_active?: boolean
          last_published_date?: string | null
          name?: string
          photo_url?: string | null
          social_links?: Json | null
          total_views?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      editor_briefs: {
        Row: {
          content_variants: Json | null
          created_at: string | null
          destinations: string[] | null
          id: string
          outline: string | null
          source_id: string | null
          source_type: string | null
          sources: string[] | null
          status: string | null
          suggested_articles: string[] | null
          summary: string | null
          theme: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content_variants?: Json | null
          created_at?: string | null
          destinations?: string[] | null
          id?: string
          outline?: string | null
          source_id?: string | null
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          suggested_articles?: string[] | null
          summary?: string | null
          theme: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content_variants?: Json | null
          created_at?: string | null
          destinations?: string[] | null
          id?: string
          outline?: string | null
          source_id?: string | null
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          suggested_articles?: string[] | null
          summary?: string | null
          theme?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      keyword_clusters: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          keywords: string[] | null
          primary_theme: string
          professions: string[] | null
          sub_theme: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          keywords?: string[] | null
          primary_theme: string
          professions?: string[] | null
          sub_theme: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          keywords?: string[] | null
          primary_theme?: string
          professions?: string[] | null
          sub_theme?: string
        }
        Relationships: []
      }
      keyword_plans: {
        Row: {
          assigned_to: string | null
          associated_clusters: string[] | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          priority: string
          start_date: string
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          associated_clusters?: string[] | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: string
          start_date: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          associated_clusters?: string[] | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: string
          start_date?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      keyword_tracking: {
        Row: {
          article_count: number | null
          category: string | null
          created_at: string | null
          id: string
          keyword: string
          last_searched_date: string | null
          priority: string | null
          status: string | null
        }
        Insert: {
          article_count?: number | null
          category?: string | null
          created_at?: string | null
          id?: string
          keyword: string
          last_searched_date?: string | null
          priority?: string | null
          status?: string | null
        }
        Update: {
          article_count?: number | null
          category?: string | null
          created_at?: string | null
          id?: string
          keyword?: string
          last_searched_date?: string | null
          priority?: string | null
          status?: string | null
        }
        Relationships: []
      }
      llm_prompts: {
        Row: {
          created_at: string | null
          function_name: string
          id: string
          include_clusters: boolean | null
          include_sources_map: boolean | null
          include_tracking_summary: boolean | null
          is_active: boolean | null
          last_updated_by: string | null
          model: string
          prompt_text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          function_name: string
          id?: string
          include_clusters?: boolean | null
          include_sources_map?: boolean | null
          include_tracking_summary?: boolean | null
          is_active?: boolean | null
          last_updated_by?: string | null
          model: string
          prompt_text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          function_name?: string
          id?: string
          include_clusters?: boolean | null
          include_sources_map?: boolean | null
          include_tracking_summary?: boolean | null
          is_active?: boolean | null
          last_updated_by?: string | null
          model?: string
          prompt_text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      news: {
        Row: {
          content_variants: Json | null
          destinations: string[] | null
          editorial_content: string | null
          editorial_headline: string | null
          editorial_summary: string | null
          headline: string
          id: string
          is_competitor_covered: boolean | null
          last_scraped_at: string | null
          matched_clusters: string[] | null
          original_author: string | null
          original_publication_date: string | null
          original_title: string | null
          perplexity_score: number | null
          source: string | null
          source_content: string | null
          status: string | null
          summary: string | null
          timestamp: string | null
          url: string
        }
        Insert: {
          content_variants?: Json | null
          destinations?: string[] | null
          editorial_content?: string | null
          editorial_headline?: string | null
          editorial_summary?: string | null
          headline: string
          id?: string
          is_competitor_covered?: boolean | null
          last_scraped_at?: string | null
          matched_clusters?: string[] | null
          original_author?: string | null
          original_publication_date?: string | null
          original_title?: string | null
          perplexity_score?: number | null
          source?: string | null
          source_content?: string | null
          status?: string | null
          summary?: string | null
          timestamp?: string | null
          url: string
        }
        Update: {
          content_variants?: Json | null
          destinations?: string[] | null
          editorial_content?: string | null
          editorial_headline?: string | null
          editorial_summary?: string | null
          headline?: string
          id?: string
          is_competitor_covered?: boolean | null
          last_scraped_at?: string | null
          matched_clusters?: string[] | null
          original_author?: string | null
          original_publication_date?: string | null
          original_title?: string | null
          perplexity_score?: number | null
          source?: string | null
          source_content?: string | null
          status?: string | null
          summary?: string | null
          timestamp?: string | null
          url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_job_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          job_name: string
          last_run: string | null
          parameters: Json
          schedule: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          job_name: string
          last_run?: string | null
          parameters?: Json
          schedule: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          job_name?: string
          last_run?: string | null
          parameters?: Json
          schedule?: string
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          cluster_alignment: string[] | null
          created_at: string | null
          id: string
          priority_tier: number | null
          source_name: string
          source_type: string | null
          source_url: string
        }
        Insert: {
          cluster_alignment?: string[] | null
          created_at?: string | null
          id?: string
          priority_tier?: number | null
          source_name: string
          source_type?: string | null
          source_url: string
        }
        Update: {
          cluster_alignment?: string[] | null
          created_at?: string | null
          id?: string
          priority_tier?: number | null
          source_name?: string
          source_type?: string | null
          source_url?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      news_approval_stats: {
        Row: {
          approval_date: string | null
          dismissed_count: number | null
          magazine_count: number | null
          mpdaily_count: number | null
          total_reviewed: number | null
          website_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      get_active_api_key: {
        Args: { service_name: string }
        Returns: string
      }
      get_approval_stats: {
        Args: { start_date: string; end_date: string }
        Returns: {
          approval_date: string
          mpdaily_count: number
          magazine_count: number
          website_count: number
          dismissed_count: number
          total_reviewed: number
        }[]
      }
      get_cron_jobs: {
        Args: Record<PropertyKey, never>
        Returns: {
          jobid: number
          jobname: string
          schedule: string
          command: string
          nodename: string
          nodeport: number
          database: string
          username: string
          active: boolean
          last_run: string
          next_run: string
        }[]
      }
      get_job_settings: {
        Args: { job_name_param: string }
        Returns: {
          created_at: string
          id: string
          is_enabled: boolean
          job_name: string
          last_run: string | null
          parameters: Json
          schedule: string
          updated_at: string
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id?: string
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      update_job_settings: {
        Args: { job_name_param: string; settings_json: Json }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "writer" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "writer", "viewer"],
    },
  },
} as const
