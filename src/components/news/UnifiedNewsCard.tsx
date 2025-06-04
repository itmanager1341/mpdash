
import { useState } from "react";
import { toast } from "sonner";
import { Edit, ExternalLink, MoreHorizontal, Trash2, CheckCircle2, FileEdit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/types/news";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  
  // Handle moving to enhancement phase
  const handleEnhanceContent = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('news')
        .update({ 
          status: 'approved_for_editing'
        })
        .eq('id', newsItem.id);
      
      if (error) throw error;
      
      toast.success("Article moved to enhancement phase");
      onStatusChange?.();
      
    } catch (err) {
      console.error("Error moving article to enhancement:", err);
      toast.error("Failed to move article to enhancement");
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
    const { status } = newsItem;
    
    if (status === 'pending') {
      return { variant: "outline" as const, label: "Pending Review", color: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    if (status === 'approved_for_editing') {
      return { variant: "default" as const, label: "Ready for Enhancement", color: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (status === 'enhanced') {
      return { variant: "default" as const, label: "Enhanced - Ready for Editorial Hub", color: "bg-green-50 text-green-700 border-green-200" };
    }
    return { variant: "outline" as const, label: status || "Unknown", color: "" };
  };

  const statusDisplay = getStatusDisplay();
  const isPending = newsItem.status === 'pending';
  const isReadyForEnhancement = newsItem.status === 'approved_for_editing';
  
  // Use editorial headline if available, otherwise fall back to original headline
  const displayHeadline = newsItem.editorial_headline || newsItem.headline;
  const displaySummary = newsItem.editorial_summary || newsItem.summary;
  
  return (
    <Card className={`overflow-hidden transition-all duration-200 hover:shadow-md ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <Badge className={statusDisplay.color}>
            {statusDisplay.label}
          </Badge>
          
          <div className="flex gap-2 items-center">
            {/* Always show perplexity score */}
            <span className="text-sm font-medium text-muted-foreground">
              Score: {newsItem.perplexity_score?.toFixed(1) || "N/A"}
            </span>
            {newsItem.editorial_headline && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                Enhanced
              </Badge>
            )}
            {newsItem.is_competitor_covered && (
              <Badge variant="secondary">Competitor</Badge>
            )}
          </div>
        </div>
        
        <CardTitle className="line-clamp-2 text-lg">
          {displayHeadline}
        </CardTitle>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{newsItem.source}</span>
          <span>•</span>
          <span>{new Date(newsItem.timestamp).toLocaleDateString()}</span>
          {newsItem.original_author && (
            <>
              <span>•</span>
              <span>by {newsItem.original_author}</span>
            </>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm line-clamp-3 mb-3">
          {displaySummary}
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
            {isPending && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={isProcessing}
                  onClick={handleDismiss}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                  onClick={handleEnhanceContent}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isProcessing ? "Processing..." : "Enhance Content"}
                </Button>
              </>
            )}

            {isReadyForEnhancement && onEditClick && (
              <Button 
                variant="default" 
                size="sm"
                className="flex items-center gap-2"
                onClick={() => onEditClick(newsItem)}
              >
                <FileEdit className="h-4 w-4" />
                Fix Source Fields
              </Button>
            )}

            {!isPending && !isReadyForEnhancement && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDetailsClick?.(newsItem)}
              >
                View Details
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => onDetailsClick?.(newsItem)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  View Details
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </CardFooter>
    </Card>
  );
}
