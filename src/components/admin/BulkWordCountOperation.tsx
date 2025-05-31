
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calculator, RefreshCw, FileText } from "lucide-react";
import { extractWordCountFromArticle, extractCleanContent, generateContentHash } from "@/utils/wordCountUtils";

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
  const [isExtractingContent, setIsExtractingContent] = useState(false);

  const selectedArticles = articles.filter(article => selectedIds.has(article.id));
  const selectedCount = selectedIds.size;

  if (selectedCount === 0) {
    return null;
  }

  // Calculate statistics for selected articles
  const stats = {
    withWordCount: selectedArticles.filter(a => a.word_count && a.word_count > 0).length,
    withoutWordCount: selectedArticles.filter(a => !a.word_count || a.word_count === 0).length,
    withCleanContent: selectedArticles.filter(a => a.clean_content).length,
    withoutCleanContent: selectedArticles.filter(a => !a.clean_content).length
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

  const handleBulkExtractCleanContent = async () => {
    setIsExtractingContent(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Process articles in batches
      const batchSize = 5; // Smaller batches for content extraction
      const batches = [];
      
      for (let i = 0; i < selectedArticles.length; i += batchSize) {
        batches.push(selectedArticles.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        for (const article of batch) {
          try {
            // Extract clean content
            const cleanContent = extractCleanContent(article);
            const contentHash = generateContentHash(cleanContent);
            const wordCount = cleanContent ? cleanContent.trim().split(/\s+/).filter(word => word.length > 0).length : 0;

            // Update the article
            const { error } = await supabase
              .from('articles')
              .update({
                clean_content: cleanContent,
                content_hash: contentHash,
                word_count: wordCount
              })
              .eq('id', article.id);

            if (error) {
              console.error(`Error updating clean content for article ${article.id}:`, error);
              errorCount++;
            } else {
              successCount++;
              console.log(`Extracted clean content for article ${article.id}: ${wordCount} words`);
            }
          } catch (error) {
            console.error(`Exception extracting clean content for article ${article.id}:`, error);
            errorCount++;
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully extracted clean content for ${successCount} articles`);
        onRefresh();
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to extract clean content for ${errorCount} articles`);
      }

    } catch (error) {
      console.error('Bulk clean content extraction error:', error);
      toast.error(`Clean content extraction failed: ${error.message}`);
    } finally {
      setIsExtractingContent(false);
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
              <span>{stats.withCleanContent} have clean content</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkExtractCleanContent}
              disabled={isExtractingContent || isCountingWords}
            >
              {isExtractingContent ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-1" />
                  Extract Clean Content ({stats.withoutCleanContent})
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkWordCount}
              disabled={isCountingWords || isExtractingContent}
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
