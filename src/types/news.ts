
export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  status: 'pending' | 'approved_for_editing' | 'approved' | 'dismissed' | string;
  
  // Original source data fields
  original_title?: string;
  original_author?: string;
  original_publication_date?: string;
  source_content?: string;
  last_scraped_at?: string;
  
  // Editorial content fields
  editorial_headline?: string;
  editorial_summary?: string;
  editorial_content?: string;
  
  // New author and template fields
  primary_author_id?: string;
  template_type?: 'contributing' | 'hybrid' | 'original' | 'announcement' | 'analysis' | 'interview' | 'policy';
  source_attribution?: string;
  byline_text?: string;
  
  content_variants?: {
    source_content?: {
      original_title?: string;
      original_summary?: string;
      full_content?: string;
      source_url?: string;
      author?: string;
      publication_date?: string;
      fetched_at?: string;
    };
    editorial_content?: {
      headline?: string;
      summary?: string;
      cta?: string;
      full_content?: string;
      enhanced_at?: string;
    };
    metadata?: {
      seo_title?: string;
      seo_description?: string;
      tags?: string[];
      editorial_notes?: string;
      workflow_stage?: 'pending' | 'enhanced' | 'ready_for_publication';
    };
    status?: 'draft' | 'ready' | 'published';
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
