
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
  
  // Count words from content variants
  if (article.content_variants) {
    const variants = typeof article.content_variants === 'string' 
      ? JSON.parse(article.content_variants) 
      : article.content_variants;
      
    if (variants?.long) {
      totalWords += calculateWordCount(variants.long);
    } else if (variants?.editorial_content?.full_content) {
      totalWords += calculateWordCount(variants.editorial_content.full_content);
    }
  }
  
  // Count words from excerpt if no content variants
  if (totalWords === 0 && article.excerpt) {
    totalWords += calculateWordCount(article.excerpt);
  }
  
  return totalWords;
}
