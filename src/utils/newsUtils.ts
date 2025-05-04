
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
 * Insert a new news item from Perplexity into the Supabase database
 */
export const insertPerplexityNewsItem = async (newsItem: PerplexityNewsItem) => {
  try {
    // Insert the news item into the database
    const { data, error } = await supabase
      .from('news')
      .insert({
        headline: newsItem.headline,
        url: newsItem.url,
        summary: newsItem.summary,
        source: newsItem.source,
        perplexity_score: newsItem.perplexity_score,
        timestamp: newsItem.timestamp,
        matched_clusters: newsItem.matched_clusters,
        is_competitor_covered: newsItem.is_competitor_covered,
        status: null, // New items start with null status
      });
    
    if (error) {
      throw error;
    }
    
    return { success: true, data };
  } catch (err) {
    console.error("Error inserting news item:", err);
    return { success: false, error: err };
  }
};

/**
 * Batch insert multiple news items from Perplexity
 */
export const batchInsertPerplexityNews = async (newsItems: PerplexityNewsItem[]) => {
  try {
    // Transform the news items to match the database schema
    const formattedItems = newsItems.map(item => ({
      headline: item.headline,
      url: item.url,
      summary: item.summary,
      source: item.source,
      perplexity_score: item.perplexity_score,
      timestamp: item.timestamp,
      matched_clusters: item.matched_clusters,
      is_competitor_covered: item.is_competitor_covered,
      status: null, // New items start with null status
    }));
    
    // Batch insert the items
    const { data, error } = await supabase
      .from('news')
      .insert(formattedItems);
    
    if (error) {
      throw error;
    }
    
    return { success: true, data };
  } catch (err) {
    console.error("Error batch inserting news items:", err);
    return { success: false, error: err };
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
    toast.error("Failed to insert example news item");
    return false;
  }
};
