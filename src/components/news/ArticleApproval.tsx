
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Newspaper, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  perplexity_score: number;
  is_competitor_covered: boolean;
  matched_clusters: string[];
  timestamp: string;
  status: string | null;
}

interface ArticleApprovalProps {
  newsItem: NewsItem;
  onApproved: () => void;
}

const ArticleApproval = ({ newsItem, onApproved }: ArticleApprovalProps) => {
  const [isApproving, setIsApproving] = useState(false);

  const approveForDestination = async (destination: string) => {
    try {
      setIsApproving(true);
      
      const normalizedDestination = destination.toLowerCase();
      
      if (normalizedDestination === "reference") {
        // For reference, move to articles table as unpublished reference content
        
        // First, update news status to indicate it's being referenced
        const { error: newsUpdateError } = await supabase
          .from("news")
          .update({ 
            status: "referenced",
          })
          .eq("id", newsItem.id);
        
        if (newsUpdateError) throw newsUpdateError;
        
        // Then create an entry in the articles table
        const { error: articleCreateError } = await supabase
          .from("articles")
          .insert({ 
            title: newsItem.headline,
            status: "unpublished_reference",
            source_news_id: newsItem.id,
            content_variants: {
              summary: newsItem.summary
            },
            related_trends: newsItem.matched_clusters
          });
          
        if (articleCreateError) throw articleCreateError;
        
        console.log(`Article saved as reference content`);
        toast.success(`Article saved as reference content`);
      } else {
        // For regular publication destinations (mpdaily, magazine)
        // Update news status with appropriate destination-based status
        const newsStatus = `approved_${normalizedDestination}`;
        const { error: newsUpdateError } = await supabase
          .from("news")
          .update({ 
            status: newsStatus,
            destinations: supabase.sql`array_append(destinations, ${normalizedDestination})`
          })
          .eq("id", newsItem.id);
        
        if (newsUpdateError) throw newsUpdateError;

        console.log(`Article approved for ${normalizedDestination} with status ${newsStatus}`);
        toast.success(`Article approved for ${destination}`);
      }
      
      onApproved();
      
    } catch (err) {
      console.error("Error processing article:", err);
      toast.error("Failed to process article");
    } finally {
      setIsApproving(false);
    }
  };

  // Determine if the news item has already been processed
  const isProcessed = newsItem.status !== null && 
                      !["suggested", null].includes(newsItem.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="flex-1" disabled={isApproving || isProcessed}>
          {isApproving ? (
            "Processing..."
          ) : isProcessed ? (
            "Processed"
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Process
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => approveForDestination("mpdaily")}>
          <Newspaper className="h-4 w-4 mr-2" />
          Approve for MPDaily
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => approveForDestination("magazine")}>
          <Newspaper className="h-4 w-4 mr-2" />
          Approve for Magazine
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => approveForDestination("reference")}>
          <BookOpen className="h-4 w-4 mr-2" />
          Save as Reference
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ArticleApproval;
