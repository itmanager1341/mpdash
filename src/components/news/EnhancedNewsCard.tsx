
import React from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewsItem } from "@/types/news";
import { ArrowRight, Check, X, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";

interface EnhancedNewsCardProps {
  newsItem: NewsItem;
  onDismiss: (item: NewsItem) => void;
  onDetailsClick: (item: NewsItem) => void;
  onStatusChange: () => void;
}

export const EnhancedNewsCard: React.FC<EnhancedNewsCardProps> = ({
  newsItem,
  onDismiss,
  onDetailsClick,
  onStatusChange
}) => {
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Helper function to format dates relative to now
  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      return "Unknown date";
    }
  };

  // Function to handle updating a news item's destination and status
  const handleUpdateNewsItem = async (destinations: string[]) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('news')
        .update({
          destinations,
          status: destinations.length > 0 ? 'approved' : 'pending'
        })
        .eq('id', newsItem.id);

      if (error) throw error;
      onStatusChange();
    } catch (err) {
      console.error("Error updating news item:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <Badge variant="outline" className="mr-2 capitalize">
            {newsItem.source || "Unknown source"}
          </Badge>
          {newsItem.perplexity_score !== null && (
            <Badge variant={
              newsItem.perplexity_score > 4 ? "default" :
              newsItem.perplexity_score > 3 ? "secondary" : 
              "outline"
            }>
              Score: {newsItem.perplexity_score.toFixed(1)}
            </Badge>
          )}
        </div>
        
        {newsItem.timestamp && (
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(newsItem.timestamp)}
          </span>
        )}
      </div>
      
      <CardContent className="pt-4 flex-grow">
        <h3 className="font-semibold text-lg mb-3 line-clamp-2">{newsItem.headline}</h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {newsItem.summary || "No summary available"}
        </p>
        
        {newsItem.matched_clusters && newsItem.matched_clusters.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Matched Clusters</p>
            <div className="flex flex-wrap gap-1.5">
              {newsItem.matched_clusters.slice(0, 3).map((cluster, index) => (
                <Badge key={index} variant="outline" className="bg-primary/10">
                  {cluster}
                </Badge>
              ))}
              {newsItem.matched_clusters.length > 3 && (
                <Badge variant="outline">+{newsItem.matched_clusters.length - 3} more</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="border-t bg-muted/5 pt-3 flex justify-between items-center gap-2">
        <Button 
          variant="ghost"
          size="sm"
          onClick={() => onDetailsClick(newsItem)}
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        
        <div className="flex items-center gap-1.5">
          {newsItem.status !== 'dismissed' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onDismiss(newsItem)}
            >
              <X className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
          )}
          
          {newsItem.status !== 'dismissed' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="default" 
                  size="sm"
                  disabled={isUpdating}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Approve For:</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={newsItem.destinations?.includes("mpdaily")}
                  onCheckedChange={(checked) => {
                    const newDestinations = [...(newsItem.destinations || [])];
                    if (checked) {
                      if (!newDestinations.includes("mpdaily")) {
                        newDestinations.push("mpdaily");
                      }
                    } else {
                      const index = newDestinations.indexOf("mpdaily");
                      if (index >= 0) {
                        newDestinations.splice(index, 1);
                      }
                    }
                    handleUpdateNewsItem(newDestinations);
                  }}
                >
                  MPDaily
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={newsItem.destinations?.includes("magazine")}
                  onCheckedChange={(checked) => {
                    const newDestinations = [...(newsItem.destinations || [])];
                    if (checked) {
                      if (!newDestinations.includes("magazine")) {
                        newDestinations.push("magazine");
                      }
                    } else {
                      const index = newDestinations.indexOf("magazine");
                      if (index >= 0) {
                        newDestinations.splice(index, 1);
                      }
                    }
                    handleUpdateNewsItem(newDestinations);
                  }}
                >
                  Magazine
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={newsItem.destinations?.includes("website")}
                  onCheckedChange={(checked) => {
                    const newDestinations = [...(newsItem.destinations || [])];
                    if (checked) {
                      if (!newDestinations.includes("website")) {
                        newDestinations.push("website");
                      }
                    } else {
                      const index = newDestinations.indexOf("website");
                      if (index >= 0) {
                        newDestinations.splice(index, 1);
                      }
                    }
                    handleUpdateNewsItem(newDestinations);
                  }}
                >
                  Website
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

// Import supabase at the top level of the file to avoid TypeScript errors
import { supabase } from "@/integrations/supabase/client";
