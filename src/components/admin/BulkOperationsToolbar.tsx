import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Users, 
  Trash2, 
  Edit, 
  Loader2,
  ExternalLink,
  CheckCircle,
  X
} from "lucide-react";
import { AuthorSelector } from "@/components/editorial/AuthorSelector";

interface BulkOperationsToolbarProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onRefresh: () => void;
  articles: any[];
}

export function BulkOperationsToolbar({ 
  selectedIds, 
  onClearSelection, 
  onRefresh,
  articles 
}: BulkOperationsToolbarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthorDialog, setShowAuthorDialog] = useState(false);
  const [showWordPressDialog, setShowWordPressDialog] = useState(false);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>("");
  const [wordpressIdInput, setWordpressIdInput] = useState("");
  const [operationProgress, setOperationProgress] = useState<{
    current: number;
    total: number;
    operation: string;
    operationId?: string;
  } | null>(null);

  const selectedCount = selectedIds.size;
  const selectedArticles = articles.filter(article => selectedIds.has(article.id));

  const handleBulkAuthorAssignment = async () => {
    if (!selectedAuthorId) {
      toast.error("Please select an author");
      return;
    }

    setIsLoading(true);
    setOperationProgress({ current: 0, total: selectedCount, operation: "Assigning authors" });

    try {
      let completed = 0;
      for (const articleId of selectedIds) {
        const { error } = await supabase
          .from('articles')
          .update({ primary_author_id: selectedAuthorId })
          .eq('id', articleId);

        if (error) throw error;
        
        completed++;
        setOperationProgress({ current: completed, total: selectedCount, operation: "Assigning authors" });
      }

      toast.success(`Successfully assigned author to ${selectedCount} articles`);
      setShowAuthorDialog(false);
      setSelectedAuthorId("");
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk author assignment error:', error);
      toast.error("Failed to assign authors to some articles");
    } finally {
      setIsLoading(false);
      setOperationProgress(null);
    }
  };

  const handleBulkWordPressSync = async () => {
    setIsLoading(true);
    const operationId = crypto.randomUUID();
    setOperationProgress({ 
      current: 0, 
      total: selectedCount, 
      operation: "Syncing with WordPress",
      operationId 
    });

    try {
      console.log(`Starting WordPress sync for ${selectedCount} selected articles...`);
      
      // Create operation record
      await supabase
        .from('sync_operations')
        .insert({
          id: operationId,
          status: 'running',
          operation_type: 'wordpress_sync',
          total_items: selectedCount,
          completed_items: 0
        });
      
      const { data, error } = await supabase.functions.invoke('wordpress-legacy-sync', {
        body: { 
          legacyMode: true,
          targetArticleIds: Array.from(selectedIds),
          operationId
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
      console.error('Bulk WordPress sync error:', error);
      toast.error(`WordPress sync failed: ${error.message}`);
    } finally {
      setIsLoading(false);
      setOperationProgress(null);
    }
  };

  const handleCancelOperation = async () => {
    if (!operationProgress?.operationId) return;
    
    try {
      // Mark operation as cancelled in database
      const { error } = await supabase
        .from('sync_operations')
        .upsert({
          id: operationProgress.operationId,
          status: 'cancelled',
          operation_type: 'wordpress_sync',
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error cancelling operation:', error);
      }

      toast.info("Cancellation requested...");
    } catch (error) {
      console.error('Cancel operation error:', error);
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

  const handleManualWordPressId = async () => {
    const articleIds = Array.from(selectedIds);
    if (articleIds.length !== 1) {
      toast.error("Please select exactly one article for manual WordPress ID assignment");
      return;
    }

    if (!wordpressIdInput || isNaN(Number(wordpressIdInput))) {
      toast.error("Please enter a valid WordPress ID");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('articles')
        .update({ wordpress_id: Number(wordpressIdInput) })
        .eq('id', articleIds[0]);

      if (error) throw error;

      toast.success("WordPress ID assigned successfully");
      setShowWordPressDialog(false);
      setWordpressIdInput("");
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Manual WordPress ID assignment error:', error);
      toast.error("Failed to assign WordPress ID");
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
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
                  {operationProgress.operationId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelOperation}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuthorDialog(true)}
                disabled={isLoading}
              >
                <Users className="h-4 w-4 mr-1" />
                Assign Author
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkWordPressSync}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                WordPress Sync
              </Button>

              {selectedCount === 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWordPressDialog(true)}
                  disabled={isLoading}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Set WP ID
                </Button>
              )}

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

      {/* Author Assignment Dialog */}
      <Dialog open={showAuthorDialog} onOpenChange={setShowAuthorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Author to {selectedCount} Articles</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Author</Label>
              <AuthorSelector
                selectedAuthorId={selectedAuthorId}
                onAuthorChange={setSelectedAuthorId}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAuthorDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleBulkAuthorAssignment}
                disabled={isLoading || !selectedAuthorId}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Assign Author
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual WordPress ID Dialog */}
      <Dialog open={showWordPressDialog} onOpenChange={setShowWordPressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign WordPress ID</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wordpress-id">WordPress Post ID</Label>
              <Input
                id="wordpress-id"
                type="number"
                value={wordpressIdInput}
                onChange={(e) => setWordpressIdInput(e.target.value)}
                placeholder="Enter WordPress post ID"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowWordPressDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleManualWordPressId}
                disabled={isLoading || !wordpressIdInput}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Assign ID
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
