
import { useState } from "react";
import { toast } from "sonner";
import { Edit, ExternalLink, MoreHorizontal, Trash2, CheckCircle2, Globe, FileEdit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/types/news";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface UnifiedNewsCardProps {
  newsItem: NewsItem;
  onDismiss?: (item: NewsItem) => Promise<void>;
  onDetailsClick?: (item: NewsItem) => void;
  onEditClick?: (item: NewsItem) => void;
  onStatusChange?: () => void;
  showActions?: boolean;
  className?: string;
}

export function UnifiedNewsCard({ 
  newsItem, 
  onDismiss, 
  onDetailsClick, 
  onEditClick,
  onStatusChange,
  showActions = true,
  className 
}: UnifiedNewsCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  
  // Handle initial approval (moves to approved_for_editing status)
  const handleApprovalForEditing = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('news')
        .update({ 
          status: 'approved_for_editing',
          destinations: [] // Clear destinations until final routing
        })
        .eq('id', newsItem.id);
      
      if (error) throw error;
      
      toast.success("Article approved for editorial enhancement");
      onStatusChange?.();
      
    } catch (err) {
      console.error("Error approving article for editing:", err);
      toast.error("Failed to approve article");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = async () => {
    if (!onDismiss) return;
    
    setIsProcessing(true);
    try {
      await onDismiss(newsItem);
    } finally {
      setIsProcessing(false);
    }
  };

  // Get status display info
  const getStatusDisplay = () => {
    const { status, destinations } = newsItem;
    
    if (status === 'pending') {
      return { variant: "outline" as const, label: "Pending Review", color: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    if (status === 'approved_for_editing') {
      return { variant: "default" as const, label: "Ready for Enhancement", color: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (status === 'approved' && destinations?.length) {
      const channelLabels = destinations
        .filter(d => d !== 'website')
        .map(d => d.charAt(0).toUpperCase() + d.slice(1));
      return { 
        variant: "default" as const, 
        label: channelLabels.length ? `Approved: ${channelLabels.join(', ')}` : "Approved", 
        color: "bg-green-50 text-green-700 border-green-200" 
      };
    }
    if (status === 'dismissed') {
      return { variant: "secondary" as const, label: "Dismissed", color: "bg-gray-50 text-gray-700 border-gray-200" };
    }
    return { variant: "outline" as const, label: status || "Unknown", color: "" };
  };

  const statusDisplay = getStatusDisplay();
  const isPending = newsItem.status === 'pending';
  const isApprovedForEditing = newsItem.status === 'approved_for_editing';
  
  return (
    <Card className={`overflow-hidden transition-all duration-200 hover:shadow-md ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <Badge className={statusDisplay.color}>
            {statusDisplay.label}
          </Badge>
          
          <div className="flex gap-1">
            {newsItem.perplexity_score && newsItem.perplexity_score > 7 && (
              <Badge variant="outline">
                Score: {newsItem.perplexity_score.toFixed(1)}
              </Badge>
            )}
            {newsItem.is_competitor_covered && (
              <Badge variant="secondary">Competitor</Badge>
            )}
          </div>
        </div>
        
        <CardTitle className="line-clamp-2 text-lg">
          {newsItem.content_variants?.editorial_content?.headline || newsItem.headline}
        </CardTitle>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{newsItem.source}</span>
          <span>•</span>
          <span>{new Date(newsItem.timestamp).toLocaleDateString()}</span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm line-clamp-3 mb-3">
          {newsItem.content_variants?.editorial_content?.summary || newsItem.summary}
        </p>
        
        {newsItem.matched_clusters && newsItem.matched_clusters.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {newsItem.matched_clusters.slice(0, 3).map((cluster, index) => (
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
          <div className="flex gap-2 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDetailsClick?.(newsItem)}
            >
              View Details
            </Button>
            
            {isPending && (
              <Button 
                variant="default" 
                size="sm"
                disabled={isProcessing}
                className="flex items-center gap-2"
                onClick={handleApprovalForEditing}
              >
                <CheckCircle2 className="h-4 w-4" />
                {isProcessing ? "Processing..." : "Approve for Editing"}
              </Button>
            )}

            {isApprovedForEditing && onEditClick && (
              <Button 
                variant="default" 
                size="sm"
                className="flex items-center gap-2"
                onClick={() => onEditClick(newsItem)}
              >
                <FileEdit className="h-4 w-4" />
                Enhance Content
              </Button>
            )}
          </div>
        )}
        
        {showActions && (
          <Popover open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="grid gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => window.open(newsItem.url, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Source
                </Button>
                {(isPending || isApprovedForEditing) && onDismiss && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleDismiss}
                    disabled={isProcessing}
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
  );
}
