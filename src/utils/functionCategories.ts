
export interface FunctionCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  dbPatterns: string[];
}

export const FUNCTION_CATEGORIES: FunctionCategory[] = [
  {
    id: 'news_search',
    label: 'News Search',
    description: 'Search for real-time news and industry developments',
    icon: 'Search',
    dbPatterns: ['news_search', 'Daily_news_search', 'fetch-perplexity-news']
  },
  {
    id: 'breaking_news',
    label: 'Breaking News Detection',
    description: 'Identify and analyze breaking news stories',
    icon: 'Zap',
    dbPatterns: ['breaking_news', 'urgent_news', 'alert']
  },
  {
    id: 'website_scraping',
    label: 'Website Scraping',
    description: 'Extract and process content from websites',
    icon: 'Globe',
    dbPatterns: ['scrape-article', 'scrape_website', 'content_extraction']
  },
  {
    id: 'article_analysis',
    label: 'Article Analysis',
    description: 'Analyze article content, quality, and performance',
    icon: 'FileText',
    dbPatterns: ['analyze-article-content', 'article_analysis', 'content_analysis']
  },
  {
    id: 'content_generation',
    label: 'Content Generation',
    description: 'Generate articles, summaries, and editorial content',
    icon: 'PenTool',
    dbPatterns: ['generate-article', 'content_creation', 'draft_generation']
  },
  {
    id: 'editorial_research',
    label: 'Editorial Research',
    description: 'Research topics and gather supporting information',
    icon: 'BookOpen',
    dbPatterns: ['magazine-research', 'editorial_research', 'topic_research']
  },
  {
    id: 'fact_checking',
    label: 'Fact Checking',
    description: 'Verify information and check source credibility',
    icon: 'CheckCircle',
    dbPatterns: ['fact_check', 'verify', 'credibility_check']
  },
  {
    id: 'seo_optimization',
    label: 'SEO Optimization',
    description: 'Optimize content for search engines and keywords',
    icon: 'TrendingUp',
    dbPatterns: ['seo_optimize', 'keyword_optimize', 'search_optimize']
  }
];

export function getFunctionCategoryByDbName(dbFunctionName: string): FunctionCategory | null {
  return FUNCTION_CATEGORIES.find(category => 
    category.dbPatterns.some(pattern => 
      dbFunctionName.toLowerCase().includes(pattern.toLowerCase())
    )
  ) || null;
}

export function getCategoriesForModel(modelId: string, assignments: Record<string, string[]>): FunctionCategory[] {
  const assignedFunctionIds = assignments[modelId] || [];
  return FUNCTION_CATEGORIES.filter(category => 
    assignedFunctionIds.includes(category.id)
  );
}

export function isModelAssignedToCategory(modelId: string, categoryId: string, assignments: Record<string, string[]>): boolean {
  const assignedFunctions = assignments[modelId] || [];
  return assignedFunctions.includes(categoryId);
}
