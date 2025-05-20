
import { useState } from "react";
import { Edit, ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/types/news";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ArticleApproval from "./ArticleApproval";

interface NewsCardProps {
  newsItem: NewsItem;
  onDismiss?: (item: NewsItem) => Promise<void>;
  onDetailsClick?: (item: NewsItem) => void;
  onStatusChange?: () => void;
  showActions?: boolean;
  className?: string;
}

export function NewsCard({ 
  newsItem, 
  onDismiss, 
  onDetailsClick, 
  onStatusChange,
  showActions = true,
  className 
}: NewsCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  
  // Function to get appropriate badge variant based on status
  const getStatusBadge = (status: string, destinations: string[] | null) => {
    if (status === 'pending') return { variant: "outline" as const, label: "New", color: "bg-amber-100 text-amber-800 border-amber-200" };
    if (status === 'approved') {
      // Check specific destinations
      const destinationLabels = (destinations || [])
        .filter(d => d !== 'website') // Website is implied for all approved articles
        .map(d => d.charAt(0).toUpperCase() + d.slice(1));
      
      const label = destinationLabels.length > 0 
        ? `Approved: ${destinationLabels.join(', ')}` 
        : "Approved";
      
      return { variant: "default" as const, label, color: "bg-green-100 text-green-800 border-green-200" };
    }
    if (status === 'dismissed') {
      return { variant: "secondary" as const, label: "Dismissed", color: "bg-gray-100 text-gray-800 border-gray-200" };
    }
    if (status === 'drafted_mpdaily') {
      return { variant: "default" as const, label: "Draft Ready", color: "bg-purple-100 text-purple-800 border-purple-200" };
    }
    
    return { variant: "outline" as const, label: status, color: "" };
  };

  // Handle quick change status
  const handleQuickStatusChange = async (newStatus: string, destinations?: string[]) => {
    try {
      const { error } = await supabase
        .from('news')
        .update({ 
          status: newStatus,
          destinations: destinations || newsItem.destinations
        })
        .eq('id', newsItem.id);
      
      if (error) throw error;
      
      toast.success(`Status changed to ${newStatus}`);
      if (onStatusChange) onStatusChange();
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Failed to update status");
    }
  };

  const statusBadge = getStatusBadge(newsItem.status, newsItem.destinations);
  
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card 
          className={`overflow-hidden transition-all duration-200 hover:shadow-md ${isHovered ? 'ring-1 ring-primary/20' : ''} ${className || ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start mb-2">
              <Badge variant="outline" className={statusBadge.color || ""}>
                {statusBadge.label}
              </Badge>
              
              <div className="flex gap-1">
                {newsItem.perplexity_score && newsItem.perplexity_score > 7 && (
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Badge>Score: {newsItem.perplexity_score?.toFixed(1)}</Badge>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="flex justify-between">
                        <h4 className="font-medium">Perplexity Score</h4>
                        <span className="font-bold">{newsItem.perplexity_score?.toFixed(1)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        High scores indicate this content is trending and relevant to your audience.
                      </p>
                    </HoverCardContent>
                  </HoverCard>
                )}
                
                {newsItem.is_competitor_covered && (
                  <Badge variant="secondary">Competitor Covered</Badge>
                )}
              </div>
            </div>
            
            <CardTitle className="line-clamp-2 text-lg">
              {newsItem.content_variants?.title || newsItem.headline}
            </CardTitle>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>Source: {newsItem.source}</span>
              <span>•</span>
              <span>{new Date(newsItem.timestamp).toLocaleDateString()}</span>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <p className="text-sm line-clamp-3">
              {newsItem.content_variants?.summary || newsItem.summary}
            </p>
            
            {newsItem.matched_clusters && newsItem.matched_clusters.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {newsItem.matched_clusters?.slice(0, 3).map((cluster, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {cluster}
                  </Badge>
                ))}
                {newsItem.matched_clusters.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{newsItem.matched_clusters.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
          
          <CardFooter className="pt-4 flex justify-between items-center gap-2">
            {showActions && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onDetailsClick?.(newsItem)}
                >
                  View details
                </Button>
                
                {newsItem.status === "pending" && (
                  <ArticleApproval 
                    newsItem={newsItem} 
                    onApproved={onStatusChange}
                    mode="dropdown"
                  />
                )}
              </div>
            )}
            
            {showActions && (
              <Popover open={isMoreOpen} onOpenChange={setIsMoreOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 rounded-full ${isHovered || isMoreOpen ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48" align="end">
                  <div className="grid gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => onDetailsClick?.(newsItem)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => window.open(newsItem.url, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View source
                    </Button>
                    {newsItem.status === "pending" && onDismiss && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDismiss(newsItem)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Dismiss
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </CardFooter>
        </Card>
      </ContextMenuTrigger>
      
      <ContextMenuContent className="w-64">
        <ContextMenuItem onClick={() => onDetailsClick?.(newsItem)}>
          View full details
        </ContextMenuItem>
        <ContextMenuItem onClick={() => window.open(newsItem.url, '_blank')}>
          Open source article
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem 
          onClick={() => handleQuickStatusChange("approved", ["mpdaily"])}
          disabled={newsItem.status === "approved" && newsItem.destinations?.includes("mpdaily")}
        >
          Approve for MPDaily
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={() => handleQuickStatusChange("approved", ["magazine"])}
          disabled={newsItem.status === "approved" && newsItem.destinations?.includes("magazine")}
        >
          Approve for Magazine
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={() => handleQuickStatusChange("pending")}
          disabled={newsItem.status === "pending"}
        >
          Mark as pending
        </ContextMenuItem>
        
        {newsItem.status === "pending" && onDismiss && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem 
              onClick={() => onDismiss(newsItem)}
              className="text-destructive focus:text-destructive"
            >
              Dismiss article
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
