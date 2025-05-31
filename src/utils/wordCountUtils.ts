
// Utility functions for word counting
export function calculateWordCount(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  // Clean the text and split by whitespace
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

export function extractWordCountFromArticle(article: any): number {
  let totalWords = 0;
  
  // Count words from title
  if (article.title) {
    totalWords += calculateWordCount(article.title);
  }
  
  // First priority: use clean_content if available
  if (article.clean_content) {
    totalWords += calculateWordCount(article.clean_content);
    return totalWords;
  }
  
  // Fallback: Count words from WordPress content
  if (article.content_variants) {
    const variants = typeof article.content_variants === 'string' 
      ? JSON.parse(article.content_variants) 
      : article.content_variants;
      
    // Check for WordPress content
    if (variants?.wordpress_content?.content) {
      const cleanContent = cleanHtmlContent(variants.wordpress_content.content);
      totalWords += calculateWordCount(cleanContent);
      return totalWords;
    }
  }
  
  // Final fallback: Count words from excerpt if no content variants
  if (article.excerpt) {
    totalWords += calculateWordCount(article.excerpt);
  }
  
  return totalWords;
}

// Helper function to extract clean content from WordPress articles
export function extractCleanContent(article: any): string {
  // PRIORITY 1: Extract from WordPress content if available (always prioritize this)
  if (article.content_variants) {
    const variants = typeof article.content_variants === 'string' 
      ? JSON.parse(article.content_variants) 
      : article.content_variants;
      
    // Check for WordPress content (this contains the full HTML article)
    if (variants?.wordpress_content?.content) {
      return cleanHtmlContent(variants.wordpress_content.content);
    }
  }
  
  // PRIORITY 2: Use existing clean_content if WordPress content not available
  if (article.clean_content) {
    return article.clean_content;
  }
  
  // PRIORITY 3: Fallback to excerpt or empty string
  return article.excerpt || '';
}

// Helper function to clean HTML content
function cleanHtmlContent(content: string): string {
  if (!content) return '';
  
  // Create a temporary div to strip HTML tags
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  
  // Get text content and clean up whitespace
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  // Clean up extra whitespace and normalize
  return textContent
    .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n')  // Clean up multiple newlines
    .trim();
}

// Generate content hash for change detection
export function generateContentHash(content: string): string {
  // Simple hash function for content change detection
  let hash = 0;
  if (content.length === 0) return hash.toString();
  
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString();
}
