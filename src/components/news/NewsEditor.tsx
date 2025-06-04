import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Save, 
  ExternalLink, 
  Loader2, 
  Download,
  X
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/types/news";

interface NewsEditorProps {
  newsItem: NewsItem;
  onSave: () => void;
  onCancel: () => void;
}

export function NewsEditor({ newsItem, onSave, onCancel }: NewsEditorProps) {
  // Source data fields only
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalAuthor, setOriginalAuthor] = useState('');
  const [originalPublicationDate, setOriginalPublicationDate] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [sourceAttribution, setSourceAttribution] = useState('');
  
  const [isScrapingContent, setIsScrapingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load existing data
    setOriginalTitle(newsItem.original_title || '');
    setOriginalAuthor(newsItem.original_author || '');
    setOriginalPublicationDate(newsItem.original_publication_date || newsItem.timestamp || '');
    setSourceContent(newsItem.source_content || '');
    setSourceAttribution(newsItem.source_attribution || '');
  }, [newsItem]);

  const scrapeArticleContent = async () => {
    setIsScrapingContent(true);
    try {
      toast.info("Scraping article content...");
      
      const { data, error } = await supabase.functions.invoke('scrape-article', {
        body: { url: newsItem.url }
      });
      
      if (error) throw error;
      
      if (data.success) {
        setOriginalTitle(data.data.title || originalTitle);
        setOriginalAuthor(data.data.author || originalAuthor);
        setSourceContent(data.data.content || sourceContent);
        if (data.data.publishedDate) {
          setOriginalPublicationDate(data.data.publishedDate);
        }
        toast.success("Article content scraped successfully");
      } else {
        throw new Error(data.error || "Failed to scrape content");
      }
    } catch (error) {
      console.error("Error scraping content:", error);
      toast.error("Failed to scrape content. Please fill in manually.");
    } finally {
      setIsScrapingContent(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('news')
        .update({
          original_title: originalTitle,
          original_author: originalAuthor,
          original_publication_date: originalPublicationDate,
          source_content: sourceContent,
          source_attribution: sourceAttribution,
          last_scraped_at: new Date().toISOString(),
          status: 'enhanced' // Mark as enhanced and ready for Editorial Hub
        })
        .eq('id', newsItem.id);

      if (error) throw error;

      toast.success("Source information updated successfully");
      onSave();
    } catch (error) {
      console.error("Error saving news item:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Enhance Source Information</h2>
            <p className="text-muted-foreground">
              Complete the source fields to prepare for Editorial Hub
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save & Mark Enhanced
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Article Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Source Article Reference
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(newsItem.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Source
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Current Title</h4>
                <p className="text-sm">{newsItem.original_title || "No title set"}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Source & URL</h4>
                <p className="text-sm">{newsItem.source} - {newsItem.url}</p>
              </div>
            </CardContent>
          </Card>

          {/* Source Information Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Source Information
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrapeArticleContent}
                  disabled={isScrapingContent}
                >
                  {isScrapingContent ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Auto-Fill from Source
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Original Title</label>
                  <Input
                    value={originalTitle}
                    onChange={(e) => setOriginalTitle(e.target.value)}
                    placeholder="Title from original article"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Original Author</label>
                  <Input
                    value={originalAuthor}
                    onChange={(e) => setOriginalAuthor(e.target.value)}
                    placeholder="Author name from source"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Publication Date</label>
                  <Input
                    type="datetime-local"
                    value={originalPublicationDate ? new Date(originalPublicationDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setOriginalPublicationDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Source Attribution</label>
                  <Input
                    value={sourceAttribution}
                    onChange={(e) => setSourceAttribution(e.target.value)}
                    placeholder="How to attribute this source"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Source Content</label>
                <Textarea
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                  placeholder="Full article content from source (for reference and analysis)"
                  rows={10}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This content will be used for reference in the Editorial Hub
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
