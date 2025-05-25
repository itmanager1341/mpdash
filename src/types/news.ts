
export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  status: string;
  content_variants?: {
    source_content?: {
      original_title?: string;
      original_summary?: string;
      author?: string;
      publication_date?: string;
    };
    editorial_content?: {
      headline?: string;
      summary?: string;
      cta?: string;
      full_content?: string;
    };
    metadata?: {
      seo_title?: string;
      seo_description?: string;
      tags?: string[];
    };
    status?: 'draft' | 'ready' | 'published';
    // Legacy fields for backward compatibility
    title?: string;
    cta?: string;
    full_content?: string;
    magazine_content?: string;
    published?: boolean;
  };
  created_at?: string;
  timestamp: string;
  source: string;
  matched_clusters?: string[];
  url: string;
  destinations: string[] | null;
  perplexity_score?: number;
  is_competitor_covered?: boolean;
}
