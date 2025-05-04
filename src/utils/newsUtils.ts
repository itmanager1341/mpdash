
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Interface for news data coming from Perplexity
 */
export interface PerplexityNewsItem {
  headline: string;
  url: string;
  summary: string;
  source: string;
  perplexity_score: number;
  timestamp: string;
  matched_clusters: string[];
  is_competitor_covered: boolean;
}

/**
 * Check if a news item with the same URL or very similar headline already exists
 */
export const checkForDuplicateNews = async (newsItem: PerplexityNewsItem): Promise<boolean> => {
  try {
    // Check for duplicate URL (exact match)
    const { data: urlMatch, error: urlError } = await supabase
      .from('news')
      .select('id')
      .eq('url', newsItem.url)
      .maybeSingle();
    
    if (urlError) {
      console.error("Error checking for URL duplicates:", urlError);
      return false; // Continue with import if we can't check
    }
    
    if (urlMatch) {
      console.log("Duplicate URL found:", newsItem.url);
      return true; // Duplicate found
    }
    
    // Check for very similar headline (might be same news from different source)
    // This is a simple implementation - in production you might use more sophisticated text matching
    const { data: headlineMatches, error: headlineError } = await supabase
      .from('news')
      .select('id, headline')
      .ilike('headline', `%${newsItem.headline.substring(0, 15)}%`)
      .limit(5);
    
    if (headlineError) {
      console.error("Error checking for headline duplicates:", headlineError);
      return false; // Continue with import if we can't check
    }
    
    // Check for headline similarity (basic implementation)
    const similarHeadlineFound = headlineMatches?.some(item => {
      // Calculate similarity (very basic - in production use a proper similarity algorithm)
      const normalizedA = item.headline.toLowerCase();
      const normalizedB = newsItem.headline.toLowerCase();
      return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
    });
    
    return !!similarHeadlineFound;
  } catch (err) {
    console.error("Error in duplicate check:", err);
    return false; // If error in checking, continue with import
  }
};

/**
 * Insert a new news item from Perplexity into the Supabase database
 */
export const insertPerplexityNewsItem = async (newsItem: PerplexityNewsItem) => {
  try {
    // Normalize and clean the data before insertion
    const cleanedItem = {
      headline: newsItem.headline.trim(),
      url: newsItem.url.trim(),
      summary: newsItem.summary.trim(),
      source: newsItem.source.trim(),
      perplexity_score: parseFloat(newsItem.perplexity_score.toString()), // Ensure it's a number
      timestamp: newsItem.timestamp || new Date().toISOString(),
      matched_clusters: Array.isArray(newsItem.matched_clusters) ? newsItem.matched_clusters : [],
      is_competitor_covered: Boolean(newsItem.is_competitor_covered),
      status: null, // New items start with null status
    };
    
    // Insert the news item into the database
    const { data, error } = await supabase
      .from('news')
      .insert(cleanedItem);
    
    if (error) {
      console.error("Database error inserting news item:", error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error("Error inserting news item:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
};

/**
 * Batch insert multiple news items from Perplexity
 */
export const batchInsertPerplexityNews = async (newsItems: PerplexityNewsItem[], options = { skipDuplicateCheck: false, minScore: 0 }) => {
  try {
    const results = {
      total: newsItems.length,
      inserted: 0,
      duplicates: 0,
      lowScore: 0,
      errors: 0
    };

    // Process each item individually to apply validation and filtering
    for (const item of newsItems) {
      // Skip items with low perplexity score
      if (item.perplexity_score < options.minScore) {
        console.log(`Skipping low-scored item (${item.perplexity_score}): ${item.headline}`);
        results.lowScore++;
        continue;
      }
      
      // Check for duplicates if not skipped
      if (!options.skipDuplicateCheck) {
        const isDuplicate = await checkForDuplicateNews(item);
        if (isDuplicate) {
          console.log(`Skipping duplicate: ${item.headline}`);
          results.duplicates++;
          continue;
        }
      }
      
      // Insert the item
      const result = await insertPerplexityNewsItem(item);
      if (result.success) {
        results.inserted++;
      } else {
        results.errors++;
        console.error(`Error inserting item ${item.headline}: ${result.error}`);
      }
    }
    
    return { success: results.errors === 0, results };
  } catch (err) {
    console.error("Error batch inserting news items:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
};

/**
 * Example usage with the provided JSON data
 */
export const insertExampleNewsItem = async () => {
  const exampleNewsItem: PerplexityNewsItem = {
    headline: "Current Mortgage Rates: May 2, 2025",
    url: "https://money.com/current-mortgage-rates/",
    summary: "Mortgage rates continued a slight downward trend, with the 30-year fixed averaging 6.85%, but remain historically elevated as GDP unexpectedly turned negative and recession fears persist. Despite improved affordability, buyer demand is subdued amid economic uncertainty, signaling ongoing risk for lenders and servicers.",
    source: "money.com",
    perplexity_score: 3.6,
    timestamp: "2025-05-02T00:00:00Z",
    matched_clusters: ["Core Mortgage Industry", "Market & Risk Indicators", "Macro & Fed Policy"],
    is_competitor_covered: false
  };

  const result = await insertPerplexityNewsItem(exampleNewsItem);
  
  if (result.success) {
    toast.success("Example news item successfully inserted!");
    return true;
  } else {
    toast.error(`Failed to insert example news item: ${result.error}`);
    return false;
  }
};
