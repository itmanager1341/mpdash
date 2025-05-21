
import { KeywordCluster } from "@/types/database";

export interface KeywordSuggestion {
  id?: string;
  keyword: string;
  score: number;
  related_clusters: string[];
  source: string;
  rationale?: string;
  status?: 'pending' | 'approved' | 'dismissed';
}

/**
 * Finds the most relevant clusters for a keyword suggestion
 */
export function findRelevantClusters(
  keyword: string, 
  clusters: KeywordCluster[], 
  maxResults = 3
): string[] {
  // This is a basic implementation that could be enhanced with more sophisticated algorithms
  const relevantClusters: Array<{ name: string; relevance: number }> = [];
  
  for (const cluster of clusters) {
    let relevance = 0;
    const clusterName = `${cluster.primary_theme}: ${cluster.sub_theme}`;
    
    // Check if keyword appears in existing keywords
    if (cluster.keywords && cluster.keywords.some(k => 
      k.toLowerCase().includes(keyword.toLowerCase()) ||
      keyword.toLowerCase().includes(k.toLowerCase())
    )) {
      relevance += 5;
    }
    
    // Check if keyword appears in cluster themes
    if (
      cluster.primary_theme.toLowerCase().includes(keyword.toLowerCase()) ||
      cluster.sub_theme.toLowerCase().includes(keyword.toLowerCase())
    ) {
      relevance += 10;
    }
    
    // Add some randomness for demo purposes
    relevance += Math.random() * 2;
    
    if (relevance > 0) {
      relevantClusters.push({ name: clusterName, relevance });
    }
  }
  
  // Sort by relevance and return top N
  return relevantClusters
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxResults)
    .map(rc => rc.name);
}

/**
 * Get suggestions from session storage
 */
export function getSuggestions(): KeywordSuggestion[] {
  try {
    const savedSuggestions = sessionStorage.getItem('keyword-suggestions');
    return savedSuggestions ? JSON.parse(savedSuggestions) : [];
  } catch (error) {
    console.error("Error retrieving suggestions from storage:", error);
    return [];
  }
}

/**
 * Save suggestions to session storage
 */
export function saveSuggestions(suggestions: KeywordSuggestion[]): void {
  try {
    sessionStorage.setItem('keyword-suggestions', JSON.stringify(suggestions));
  } catch (error) {
    console.error("Error saving suggestions to storage:", error);
  }
}

/**
 * Update a suggestion's status
 */
export function updateSuggestionStatus(
  keyword: string, 
  newStatus: 'pending' | 'approved' | 'dismissed'
): KeywordSuggestion[] {
  const suggestions = getSuggestions();
  const updated = suggestions.map(s => 
    s.keyword === keyword ? { ...s, status: newStatus } : s
  );
  saveSuggestions(updated);
  return updated;
}

/**
 * Get count of pending suggestions
 */
export function getPendingSuggestionsCount(): number {
  return getSuggestions().filter(s => s.status === 'pending').length;
}
