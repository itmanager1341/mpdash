
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Newspaper, BookOpen, Globe, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewsItem } from "@/types/news";

interface ArticleApprovalProps {
  newsItem: NewsItem;
  onApproved: () => void;
  mode?: "dropdown" | "multiselect";
}

const ArticleApproval = ({ newsItem, onApproved, mode = "dropdown" }: ArticleApprovalProps) => {
  const [isApproving, setIsApproving] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>(
    newsItem.destinations || []
  );

  // Check if the item has already been processed
  const isProcessed = newsItem.status !== "pending";

  const approveForDestinations = async (destinations: string[] = []) => {
    try {
      setIsApproving(true);
      
      // Always include website as a destination
      const uniqueDestinations = Array.from(new Set([...destinations, "website"]));
      
      // Update the news item with its new status and destinations
      const { error } = await supabase
        .from("news")
        .update({ 
          status: "approved",
          destinations: uniqueDestinations
        })
        .eq("id", newsItem.id);
      
      if (error) throw error;
      
      // Create reference entry if needed
      if (destinations.includes("reference")) {
        // Create an entry in the articles table for reference
        const { error: articleCreateError } = await supabase
          .from("articles")
          .insert({ 
            title: newsItem.original_title,
            status: "unpublished_reference",
            source_news_id: newsItem.id,
            content_variants: {
              summary: newsItem.summary
            },
            related_trends: newsItem.matched_clusters
          });
          
        if (articleCreateError) throw articleCreateError;
      }
      
      // Format destination list for toast message
      const destinationNames = uniqueDestinations
        .filter(d => d !== "website")  // Don't show website in toast, it's implicit
        .map(d => d.charAt(0).toUpperCase() + d.slice(1))
        .join(", ");
      
      toast.success(`Article approved for ${destinationNames || "Website"}`);
      onApproved();
      
    } catch (err) {
      console.error("Error processing article:", err);
      toast.error("Failed to process article");
    } finally {
      setIsApproving(false);
    }
  };

  const handleCheckboxChange = (destination: string, checked: boolean) => {
    setSelectedDestinations(prev => 
      checked 
        ? [...prev, destination] 
        : prev.filter(d => d !== destination)
    );
  };

  const saveMultiselect = async () => {
    await approveForDestinations(selectedDestinations);
  };

  const dismissArticle = async () => {
    try {
      setIsApproving(true);
      
      // Update the news item to dismissed status
      const { error } = await supabase
        .from("news")
        .update({ 
          status: "dismissed",
          destinations: [] // Clear destinations when dismissing
        })
        .eq("id", newsItem.id);
      
      if (error) throw error;
      
      toast.success("Article dismissed");
      onApproved();
      
    } catch (err) {
      console.error("Error dismissing article:", err);
      toast.error("Failed to dismiss article");
    } finally {
      setIsApproving(false);
    }
  };

  // For multiselect mode, render checkboxes
  if (mode === "multiselect") {
    return (
      <div className="space-y-2">
        <div className="flex flex-col gap-1.5">
          <div className="font-medium text-sm">Destinations:</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`mpdaily-${newsItem.id}`}
                checked={selectedDestinations.includes("mpdaily")}
                onChange={e => handleCheckboxChange("mpdaily", e.target.checked)}
                className="rounded text-primary"
              />
              <label htmlFor={`mpdaily-${newsItem.id}`} className="text-sm flex items-center">
                <Newspaper className="h-3.5 w-3.5 mr-1" />
                MPDaily
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`magazine-${newsItem.id}`}
                checked={selectedDestinations.includes("magazine")}
                onChange={e => handleCheckboxChange("magazine", e.target.checked)}
                className="rounded text-primary"
              />
              <label htmlFor={`magazine-${newsItem.id}`} className="text-sm flex items-center">
                <BookOpen className="h-3.5 w-3.5 mr-1" />
                Magazine
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`reference-${newsItem.id}`}
                checked={selectedDestinations.includes("reference")}
                onChange={e => handleCheckboxChange("reference", e.target.checked)}
                className="rounded text-primary"
              />
              <label htmlFor={`reference-${newsItem.id}`} className="text-sm flex items-center">
                <BookOpen className="h-3.5 w-3.5 mr-1" />
                Reference
              </label>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            <Globe className="h-3 w-3 inline mr-1" />
            Website will be included automatically
          </div>
        </div>

        <div className="flex gap-2 pt-1 justify-end">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={dismissArticle}
            disabled={isApproving}
          >
            <X className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={saveMultiselect}
            disabled={isApproving || selectedDestinations.length === 0}
          >
            {isApproving ? "Processing..." : "Approve"}
          </Button>
        </div>
      </div>
    );
  }

  // For dropdown mode, render the dropdown menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          className="flex-1" 
          disabled={isApproving || isProcessed}
          variant={isProcessed ? "secondary" : "default"}
        >
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
        <DropdownMenuItem onClick={() => approveForDestinations(["mpdaily"])}>
          <Newspaper className="h-4 w-4 mr-2" />
          Approve for MPDaily
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => approveForDestinations(["magazine"])}>
          <BookOpen className="h-4 w-4 mr-2" />
          Approve for Magazine
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => approveForDestinations(["mpdaily", "magazine"])}>
          <Newspaper className="h-4 w-4 mr-2" />
          Approve for Both
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => approveForDestinations(["reference"])}>
          <BookOpen className="h-4 w-4 mr-2" />
          Save as Reference
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ArticleApproval;
