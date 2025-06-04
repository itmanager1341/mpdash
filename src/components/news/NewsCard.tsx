
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Clock, 
  ExternalLink, 
  TrendingUp, 
  Edit,
  Save,
  X,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/types/news";
import ArticleApproval from "./ArticleApproval";

interface NewsCardProps {
  newsItem: NewsItem;
  onApproved: () => void;
  showApprovalActions?: boolean;
}

export default function NewsCard({ newsItem, onApproved, showApprovalActions = true }: NewsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState(newsItem.summary || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedSummary(newsItem.summary || "");
  };

  const handleSave = async () => {
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

  const handleCancel = () => {
    setEditedSummary(newsItem.summary || "");
    setIsEditing(false);
  };

  const openOriginalArticle = () => {
    if (newsItem.url) {
      window.open(newsItem.url, '_blank', 'noopener,noreferrer');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Determine display title
  const displayTitle = newsItem.original_title || "Untitled Article";

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg line-clamp-2 mb-2">
              {displayTitle}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
            {newsItem.status && (
              <Badge className={getStatusColor(newsItem.status)}>
                {newsItem.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                {newsItem.status === 'dismissed' && <X className="h-3 w-3 mr-1" />}
                {newsItem.status === 'pending' && <AlertTriangle className="h-3 w-3 mr-1" />}
                {newsItem.status.charAt(0).toUpperCase() + newsItem.status.slice(1)}
              </Badge>
            )}
            
            {newsItem.url && (
              <Button
                variant="outline"
                size="sm"
                onClick={openOriginalArticle}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">Summary</h4>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
              >
                <Edit className="h-4 w-4" />
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
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {newsItem.summary || "No summary available"}
            </p>
          )}
        </div>

        {/* Keywords */}
        {newsItem.matched_clusters && newsItem.matched_clusters.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Keywords</h4>
            <div className="flex flex-wrap gap-2">
              {newsItem.matched_clusters.map((cluster, index) => (
                <Badge key={index} variant="secondary">
                  {cluster}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Destinations */}
        {newsItem.destinations && newsItem.destinations.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Approved For</h4>
            <div className="flex flex-wrap gap-2">
              {newsItem.destinations.map((destination, index) => (
                <Badge key={index} variant="outline">
                  {destination.charAt(0).toUpperCase() + destination.slice(1)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Competitor coverage warning */}
        {newsItem.is_competitor_covered && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">This story has been covered by competitors</span>
          </div>
        )}

        {/* Approval actions */}
        {showApprovalActions && (
          <ArticleApproval
            newsItem={newsItem}
            onApproved={onApproved}
            mode="dropdown"
          />
        )}
      </CardContent>
    </Card>
  );
}
