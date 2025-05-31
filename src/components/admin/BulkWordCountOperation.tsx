
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calculator, RefreshCw } from "lucide-react";
import { extractWordCountFromArticle } from "@/utils/wordCountUtils";

interface BulkWordCountOperationProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onRefresh: () => void;
  articles: any[];
}

export function BulkWordCountOperation({ 
  selectedIds, 
  onClearSelection, 
  onRefresh, 
  articles
}: BulkWordCountOperationProps) {
  const [isCountingWords, setIsCountingWords] = useState(false);

  const selectedArticles = articles.filter(article => selectedIds.has(article.id));
  const selectedCount = selectedIds.size;

  if (selectedCount === 0) {
    return null;
  }

  // Calculate statistics for selected articles
  const stats = {
    withWordCount: selectedArticles.filter(a => a.word_count && a.word_count > 0).length,
    withoutWordCount: selectedArticles.filter(a => !a.word_count || a.word_count === 0).length
  };

  const handleBulkWordCount = async () => {
    setIsCountingWords(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Process articles in batches to avoid overwhelming the database
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < selectedArticles.length; i += batchSize) {
        batches.push(selectedArticles.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const updates = batch.map(article => {
          const wordCount = extractWordCountFromArticle(article);
          return {
            id: article.id,
            word_count: wordCount
          };
        });

        // Update word counts for this batch
        for (const update of updates) {
          try {
            const { error } = await supabase
              .from('articles')
              .update({ word_count: update.word_count })
              .eq('id', update.id);

            if (error) {
              console.error(`Error updating word count for article ${update.id}:`, error);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (error) {
            console.error(`Exception updating word count for article ${update.id}:`, error);
            errorCount++;
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully counted words for ${successCount} articles`);
        onRefresh();
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to count words for ${errorCount} articles`);
      }

    } catch (error) {
      console.error('Bulk word count error:', error);
      toast.error(`Word counting failed: ${error.message}`);
    } finally {
      setIsCountingWords(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-sm">
              {selectedCount} selected
            </Badge>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{stats.withWordCount} have word count</span>
              <span>•</span>
              <span>{stats.withoutWordCount} need counting</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkWordCount}
              disabled={isCountingWords}
            >
              {isCountingWords ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Counting...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-1" />
                  Count Words ({stats.withoutWordCount > 0 ? stats.withoutWordCount : selectedCount})
                </>
              )}
            </Button>

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
