
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  destinations: string[] | null;
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
      
      // 1. Update news status with appropriate destination-based status
      const newsStatus = `queued_${normalizedDestination}`;
      const { error: newsUpdateError } = await supabase
        .from("news")
        .update({ 
          status: newsStatus, 
          destinations: [normalizedDestination] 
        })
        .eq("id", newsItem.id);
      
      if (newsUpdateError) throw newsUpdateError;

      // 2. Create a new article entry
      const { error: articleError } = await supabase
        .from("articles")
        .insert({
          title: newsItem.headline,
          content_variants: {
            summary: newsItem.summary
          },
          status: newsStatus,
          destinations: [normalizedDestination],
          source_news_id: newsItem.id,
          related_trends: newsItem.matched_clusters
        });
      
      if (articleError) throw articleError;

      console.log(`Article approved for ${normalizedDestination} with status ${newsStatus}`);
      toast.success(`Article approved for ${destination}`);
      onApproved();
      
    } catch (err) {
      console.error("Error approving article:", err);
      toast.error("Failed to approve article");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="flex-1" disabled={isApproving || newsItem.status !== null}>
          {isApproving ? (
            "Approving..."
          ) : newsItem.status ? (
            "Approved"
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => approveForDestination("mpdaily")}>
          <Newspaper className="h-4 w-4 mr-2" />
          MPDaily
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => approveForDestination("magazine")}>
          <Newspaper className="h-4 w-4 mr-2" />
          Magazine
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => approveForDestination("website")}>
          <Newspaper className="h-4 w-4 mr-2" />
          Website
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ArticleApproval;
