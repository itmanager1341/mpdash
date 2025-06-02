
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Trash2, 
  RefreshCw, 
  Download,
  Zap,
  Package
} from "lucide-react";

interface SimplifiedBulkOperationsProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onRefresh: () => void;
  articles: any[];
  onBulkProcessChunks?: () => void;
  isProcessingChunks?: boolean;
}

export function SimplifiedBulkOperations({ 
  selectedIds, 
  onClearSelection, 
  onRefresh, 
  articles,
  onBulkProcessChunks,
  isProcessingChunks = false
}: SimplifiedBulkOperationsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const selectedArticles = articles.filter(article => selectedIds.has(article.id));
  const selectedCount = selectedIds.size;

  if (selectedCount === 0) {
    return null;
  }

  // Calculate statistics for selected articles - removed legacy embedding stats
  const stats = {
    chunked: selectedArticles.filter(a => a.is_chunked).length,
    notChunked: selectedArticles.filter(a => !a.is_chunked).length,
    withWordCount: selectedArticles.filter(a => a.word_count > 0).length,
    needsChunking: selectedArticles.filter(a => !a.is_chunked && a.word_count > 0).length
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedCount} articles? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`Successfully deleted ${selectedCount} articles`);
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error(`Failed to delete articles: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('wordpress-legacy-sync', {
        body: { 
          legacyMode: true,
          targetArticleIds: Array.from(selectedIds)
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Successfully synced ${selectedCount} articles`);
        onRefresh();
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Bulk sync error:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const exportSelectedArticles = () => {
    const csvContent = selectedArticles.map(article => ({
      id: article.id,
      title: article.title,
      status: article.status,
      published_at: article.published_at,
      word_count: article.word_count,
      is_chunked: article.is_chunked,
      chunks_count: article.chunks_count,
      wordpress_id: article.wordpress_id,
      author: article.authors?.name || article.wordpress_author_name || 'Unknown'
    }));

    const csv = [
      Object.keys(csvContent[0]).join(','),
      ...csvContent.map(row => Object.values(row).map(val => `"${val || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `articles-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${selectedCount} articles`);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-sm">
              {selectedCount} selected
            </Badge>
            
            {/* Updated Statistics - removed embedding references */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                <span>{stats.chunked} chunked</span>
              </div>
              <span>•</span>
              <span>{stats.withWordCount} with word count</span>
              <span>•</span>
              <span>{stats.needsChunking} ready to chunk</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Chunk Processing Button */}
            {onBulkProcessChunks && stats.needsChunking > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkProcessChunks}
                disabled={isProcessingChunks}
              >
                {isProcessingChunks ? (
                  <>
                    <Zap className="h-4 w-4 mr-1 animate-pulse" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-1" />
                    Process Chunks ({stats.needsChunking})
                  </>
                )}
              </Button>
            )}

            {/* Sync */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Sync
                </>
              )}
            </Button>

            {/* Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={exportSelectedArticles}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>

            {/* Delete */}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </>
              )}
            </Button>

            {/* Clear Selection */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
