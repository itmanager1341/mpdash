
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Interface for news data coming from Perplexity
 */
export interface PerplexityNewsItem {
  headline?: string;
  title?: string;  // Support both formats
  url: string;
  summary?: string;
  description?: string; // Support both formats
  source?: string;
  perplexity_score?: number;
  relevance_score?: number; // Support both formats
  score?: number; // Support another format variant
  timestamp?: string;
  matched_clusters?: string[];
  clusters?: string[]; // Support both formats
  is_competitor_covered?: boolean;
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
    
    // Get title from either property
    const title = newsItem.headline || newsItem.title || "";
    
    // Skip title similarity check for very short titles or system messages
    if (title && title.length > 15 && !title.includes("News Import Information")) {
      const { data: titleMatches, error: titleError } = await supabase
        .from('news')
        .select('id, original_title')
        .ilike('original_title', `%${title.substring(0, 15)}%`)
        .limit(5);
      
      if (titleError) {
        console.error("Error checking for title duplicates:", titleError);
        return false; // Continue with import if we can't check
      }
      
      // Check for title similarity (basic implementation)
      const similarTitleFound = titleMatches?.some(item => {
        // Calculate similarity (very basic - in production use a proper similarity algorithm)
        const normalizedA = (item.original_title || "").toLowerCase();
        const normalizedB = title.toLowerCase();
        return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
      });
      
      return !!similarTitleFound;
    }
    
    return false;
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
    // Normalize and clean the data before insertion - map title to original_title
    const title = newsItem.headline || newsItem.title || "";
    const summary = newsItem.summary || newsItem.description || "";
    const source = newsItem.source || (newsItem.url ? new URL(newsItem.url).hostname.replace('www.', '') : "");
    const score = newsItem.perplexity_score || newsItem.relevance_score || newsItem.score || 0.5;
    const matched_clusters = Array.isArray(newsItem.matched_clusters) ? newsItem.matched_clusters : 
                             Array.isArray(newsItem.clusters) ? newsItem.clusters : [];
                             
    if (!title || !newsItem.url) {
      return { success: false, error: "Missing required title or URL" };
    }

    // For system messages or temp data, don't insert
    if (title.includes("News Import Information") || newsItem.url === "#") {
      console.log("Skipping system message or placeholder data:", title);
      return { success: false, error: "System message or placeholder data" };
    }
    
    const cleanedItem = {
      original_title: title.trim(), // Map title to original_title field
      url: newsItem.url.trim(),
      summary: summary.trim(),
      source: source.trim(),
      perplexity_score: parseFloat(score.toString()), // Ensure it's a number
      timestamp: newsItem.timestamp || new Date().toISOString(),
      matched_clusters: matched_clusters,
      is_competitor_covered: Boolean(newsItem.is_competitor_covered),
      status: 'pending', // All new items start as pending with our new schema
      destinations: [] // Empty destinations array
    };
    
    // Log what we're trying to insert
    console.log("Attempting to insert news item:", JSON.stringify(cleanedItem));
    
    // Insert the news item into the database
    const { error } = await supabase
      .from('news')
      .insert(cleanedItem);
    
    if (error) {
      console.error("Database error inserting news item:", error);
      return { success: false, error: error.message };
    }
    
    console.log("Successfully inserted news item:", cleanedItem.original_title);
    return { success: true };
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
      errors: 0,
      invalidData: 0
    };

    // Validate that we have actual news items to process
    if (!Array.isArray(newsItems)) {
      console.error("Invalid data: newsItems is not an array", newsItems);
      return {
        success: false,
        error: "Invalid data: newsItems is not an array",
        results
      };
    }

    console.log(`Processing ${newsItems.length} news items with options:`, options);

    // Process each item individually to apply validation and filtering
    for (const item of newsItems) {
      // Basic data validation
      if (!item || typeof item !== 'object') {
        console.warn("Invalid item in newsItems array:", item);
        results.invalidData++;
        continue;
      }

      // Skip items without URL or headline/title
      if (!item.url || (!item.headline && !item.title)) {
        console.warn("Skipping invalid item missing URL or headline:", item);
        results.invalidData++;
        continue;
      }

      // Skip system messages or placeholders
      if ((item.headline?.includes("News Import Information") || item.title?.includes("News Import Information")) && item.url === "#") {
        console.log("Skipping system message:", item.headline || item.title);
        results.invalidData++;
        continue;
      }

      // Get score from all possible properties
      const score = item.perplexity_score || item.relevance_score || item.score || 0;
      
      // Skip items with low perplexity score
      if (score < options.minScore) {
        console.log(`Skipping low-scored item (${score}): ${item.headline || item.title}`);
        results.lowScore++;
        continue;
      }
      
      // Check for duplicates if not skipped
      if (!options.skipDuplicateCheck) {
        const isDuplicate = await checkForDuplicateNews(item);
        if (isDuplicate) {
          console.log(`Skipping duplicate: ${item.headline || item.title}`);
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
        console.error(`Error inserting item ${item.headline || item.title}: ${result.error}`);
      }
    }
    
    return { 
      success: results.inserted > 0, 
      results 
    };
  } catch (err) {
    console.error("Error batch inserting news items:", err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err) 
    };
  }
};

/**
 * Example usage with the provided JSON data
 */
export const insertExampleNewsItem = async () => {
  const exampleNewsItem: PerplexityNewsItem = {
    title: "Current Mortgage Rates: May 2, 2025",
    url: "https://money.com/current-mortgage-rates/",
    summary: "Mortgage rates continued a slight downward trend, with the 30-year fixed averaging 6.85%, but remain historically elevated as GDP unexpectedly turned negative and recession fears persist. Despite improved affordability, buyer demand is subdued amid economic uncertainty, signaling ongoing risk for lenders and servicers.",
    source: "money.com",
    relevance_score: 3.6,
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
