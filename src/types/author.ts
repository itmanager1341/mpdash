
export interface Author {
  id: string;
  name: string;
  email?: string;
  bio?: string;
  photo_url?: string;
  social_links?: {
    twitter?: string;
    linkedin?: string;
    website?: string;
  };
  expertise_areas?: string[];
  author_type: 'internal' | 'external' | 'contributor';
  is_active: boolean;
  user_id?: string;
  wordpress_author_id?: number;
  wordpress_author_name?: string;
  article_count: number;
  total_views: number;
  average_rating: number;
  first_published_date?: string;
  last_published_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ArticleTemplate {
  type: 'contributing' | 'hybrid' | 'original' | 'announcement' | 'analysis' | 'interview' | 'policy';
  name: string;
  description: string;
  requiresAttribution: boolean;
  defaultBylineFormat: string;
}

export const ARTICLE_TEMPLATES: ArticleTemplate[] = [
  {
    type: 'contributing',
    name: 'Contributing Article',
    description: 'Full original content by 3rd party reporter or expert',
    requiresAttribution: true,
    defaultBylineFormat: 'By {author_name}'
  },
  {
    type: 'hybrid',
    name: 'Hybrid Article',
    description: 'Primarily 3rd party source with MP commentary intermixed',
    requiresAttribution: true,
    defaultBylineFormat: 'By {author_name}, with reporting from {source}'
  },
  {
    type: 'original',
    name: 'Original Article',
    description: 'Original content by MP writer/reporter',
    requiresAttribution: false,
    defaultBylineFormat: 'By {author_name}'
  },
  {
    type: 'announcement',
    name: 'Industry Announcement',
    description: 'Government/industry announcements with minimal commentary',
    requiresAttribution: false,
    defaultBylineFormat: 'MortgagePoint Staff'
  },
  {
    type: 'analysis',
    name: 'Market Analysis',
    description: 'Data-driven analysis with multiple sources',
    requiresAttribution: false,
    defaultBylineFormat: 'By {author_name}'
  },
  {
    type: 'interview',
    name: 'Interview/Profile',
    description: 'Q&A or profile piece with industry executives',
    requiresAttribution: false,
    defaultBylineFormat: 'Interview by {author_name}'
  },
  {
    type: 'policy',
    name: 'Policy Analysis',
    description: 'Regulatory change analysis and implications',
    requiresAttribution: false,
    defaultBylineFormat: 'By {author_name}'
  }
];
