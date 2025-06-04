
import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Clock, 
  ExternalLink, 
  TrendingUp, 
  Edit3, 
  Save, 
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/types/news";
import ArticleApproval from "./ArticleApproval";

interface EnhancedNewsCardProps {
  newsItem: NewsItem;
  onApproved: () => void;
  showApprovalActions?: boolean;
}

const EnhancedNewsCard = ({ newsItem, onApproved, showApprovalActions = true }: EnhancedNewsCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState(newsItem.summary || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from("news")
        .update({ summary: editedSummary })
        .eq("id", newsItem.id);
      
      if (error) throw error;
      
      toast.success("Summary updated successfully");
      setIsEditing(false);
      onApproved(); // Refresh the data
      
    } catch (err) {
      console.error("Error updating summary:", err);
      toast.error("Failed to update summary");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedSummary(newsItem.summary || "");
    setIsEditing(false);
  };

  const openOriginalArticle = () => {
    if (newsItem.url) {
      window.open(newsItem.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Determine display title
  const displayTitle = newsItem.original_title || "Untitled Article";

  return (
    <Card className="w-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
              {displayTitle}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span>{new Date(newsItem.timestamp).toLocaleDateString()}</span>
              <span>•</span>
              <span>{newsItem.source}</span>
              {newsItem.perplexity_score && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>{newsItem.perplexity_score.toFixed(1)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {newsItem.url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={openOriginalArticle}
                className="flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-shrink-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Summary section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Summary</span>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-6 px-2"
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  placeholder="Edit the summary..."
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {newsItem.summary || "No summary available"}
              </p>
            )}
          </div>

          {/* Keywords */}
          {newsItem.matched_clusters && newsItem.matched_clusters.length > 0 && (
            <div>
              <span className="text-sm font-medium block mb-2">Keywords</span>
              <div className="flex flex-wrap gap-1">
                {newsItem.matched_clusters.slice(0, isExpanded ? undefined : 3).map((cluster, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {cluster}
                  </Badge>
                ))}
                {!isExpanded && newsItem.matched_clusters.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{newsItem.matched_clusters.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Competitor coverage */}
          {newsItem.is_competitor_covered && (
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">
                Competitor Covered
              </Badge>
            </div>
          )}
        </div>
      </CardContent>

      {showApprovalActions && (
        <CardFooter className="pt-2">
          <ArticleApproval
            newsItem={newsItem}
            onApproved={onApproved}
            mode="multiselect"
          />
        </CardFooter>
      )}
    </Card>
  );
};

export default EnhancedNewsCard;
