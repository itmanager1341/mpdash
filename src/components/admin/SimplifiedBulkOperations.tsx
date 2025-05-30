
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Trash2,
  Loader2,
  X
} from "lucide-react";

interface SimplifiedBulkOperationsProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onRefresh: () => void;
  articles: any[];
}

export function SimplifiedBulkOperations({ 
  selectedIds, 
  onClearSelection, 
  onRefresh,
  articles 
}: SimplifiedBulkOperationsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [operationProgress, setOperationProgress] = useState<{
    current: number;
    total: number;
    operation: string;
  } | null>(null);

  const selectedCount = selectedIds.size;
  const selectedArticles = articles.filter(article => selectedIds.has(article.id));

  const handleWordPressSync = async () => {
    setIsLoading(true);
    setOperationProgress({ 
      current: 0, 
      total: selectedCount, 
      operation: "Syncing with WordPress"
    });

    try {
      console.log(`Starting WordPress sync for ${selectedCount} selected articles...`);
      
      const { data, error } = await supabase.functions.invoke('wordpress-legacy-sync', {
        body: { 
          legacyMode: true,
          targetArticleIds: Array.from(selectedIds)
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data.success) {
        const { results } = data;
        toast.success(
          `WordPress sync completed! ${results.updated} articles updated, ${results.matched} matched, ${results.skipped} skipped`
        );
        onClearSelection();
        onRefresh();
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('WordPress sync error:', error);
      toast.error(`WordPress sync failed: ${error.message}`);
    } finally {
      setIsLoading(false);
      setOperationProgress(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedCount} articles? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setOperationProgress({ current: 0, total: selectedCount, operation: "Deleting articles" });

    try {
      let completed = 0;
      for (const articleId of selectedIds) {
        const { error } = await supabase
          .from('articles')
          .delete()
          .eq('id', articleId);

        if (error) throw error;
        
        completed++;
        setOperationProgress({ current: completed, total: selectedCount, operation: "Deleting articles" });
      }

      toast.success(`Successfully deleted ${selectedCount} articles`);
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error("Failed to delete some articles");
    } finally {
      setIsLoading(false);
      setOperationProgress(null);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <Card className="mb-4">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-sm">
              {selectedCount} article{selectedCount !== 1 ? 's' : ''} selected
            </Badge>
            
            {operationProgress && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {operationProgress.operation}: {operationProgress.current}/{operationProgress.total}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleWordPressSync}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Sync with WordPress
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isLoading}
            >
              Clear Selection
            </Button>
          </div>
        </div>

        {/* Selection Summary */}
        <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Missing WP ID: </span>
            <span className="font-medium">
              {selectedArticles.filter(a => !a.wordpress_id).length}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Missing Author: </span>
            <span className="font-medium">
              {selectedArticles.filter(a => !a.primary_author_id).length}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Published: </span>
            <span className="font-medium">
              {selectedArticles.filter(a => a.status === 'published').length}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Drafts: </span>
            <span className="font-medium">
              {selectedArticles.filter(a => a.status === 'draft').length}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
