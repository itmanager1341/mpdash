import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Save, 
  ExternalLink, 
  Loader2, 
  CheckCircle, 
  Newspaper, 
  BookOpen, 
  Globe,
  Download,
  Calendar,
  User 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/types/news";
import { ArticleMetadataForm } from "@/components/editorial/ArticleMetadataForm";

interface NewsEditorProps {
  newsItem: NewsItem;
  onSave: () => void;
  onCancel: () => void;
}

export function NewsEditor({ newsItem, onSave, onCancel }: NewsEditorProps) {
  // Original source data
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalAuthor, setOriginalAuthor] = useState('');
  const [originalPublicationDate, setOriginalPublicationDate] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  
  // Editorial data
  const [editorialHeadline, setEditorialHeadline] = useState('');
  const [editorialSummary, setEditorialSummary] = useState('');
  const [editorialContent, setEditorialContent] = useState('');
  const [editorialNotes, setEditorialNotes] = useState('');
  
  // Article metadata with optional fields
  const [articleMetadata, setArticleMetadata] = useState({
    authorId: newsItem.primary_author_id,
    templateType: newsItem.template_type,
    sourceAttribution: newsItem.source_attribution || '',
    contentComplexityScore: 1,
    bylineText: newsItem.byline_text || ''
  });
  
  const [isScrapingContent, setIsScrapingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);

  useEffect(() => {
    // Load existing data from database columns and content_variants
    setOriginalTitle(newsItem.original_title || newsItem.headline || '');
    setOriginalAuthor(newsItem.original_author || '');
    setOriginalPublicationDate(newsItem.original_publication_date || newsItem.timestamp || '');
    setSourceContent(newsItem.source_content || '');
    
    setEditorialHeadline(newsItem.editorial_headline || newsItem.headline || '');
    setEditorialSummary(newsItem.editorial_summary || newsItem.summary || '');
    setEditorialContent(newsItem.editorial_content || '');
    
    if (newsItem.content_variants?.metadata?.editorial_notes) {
      setEditorialNotes(newsItem.content_variants.metadata.editorial_notes);
    }
  }, [newsItem]);

  const handleMetadataChange = (metadata: {
    authorId?: string;
    templateType?: string;
    sourceAttribution?: string;
    contentComplexityScore?: number;
    bylineText?: string;
  }) => {
    setArticleMetadata(prev => ({
      ...prev,
      ...metadata
    }));
  };

  const scrapeArticleContent = async () => {
    setIsScrapingContent(true);
    try {
      toast.info("Scraping article content...");
      
      const { data, error } = await supabase.functions.invoke('scrape-article', {
        body: { url: newsItem.url }
      });
      
      if (error) throw error;
      
      if (data.success) {
        setOriginalTitle(data.data.title);
        setOriginalAuthor(data.data.author);
        setSourceContent(data.data.content);
        if (data.data.publishedDate) {
          setOriginalPublicationDate(data.data.publishedDate);
        }
        toast.success("Article content scraped successfully");
      } else {
        throw new Error(data.error || "Failed to scrape content");
      }
    } catch (error) {
      console.error("Error scraping content:", error);
      toast.error("Failed to scrape content. Please copy and paste manually.");
    } finally {
      setIsScrapingContent(false);
    }
  };

  const handleDestinationToggle = (destination: string) => {
    setSelectedDestinations(prev => 
      prev.includes(destination) 
        ? prev.filter(d => d !== destination)
        : [...prev, destination]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const contentVariants = {
        source_content: {
          original_title: originalTitle,
          original_summary: newsItem.summary,
          full_content: sourceContent,
          source_url: newsItem.url,
          author: originalAuthor,
          publication_date: originalPublicationDate,
          fetched_at: newsItem.last_scraped_at || new Date().toISOString()
        },
        editorial_content: {
          headline: editorialHeadline,
          summary: editorialSummary,
          full_content: editorialContent,
          enhanced_at: new Date().toISOString()
        },
        metadata: {
          editorial_notes: editorialNotes,
          workflow_stage: selectedDestinations.length > 0 ? "ready_for_publication" : "enhanced"
        }
      };

      const updateData: any = {
        original_title: originalTitle,
        original_author: originalAuthor,
        original_publication_date: originalPublicationDate,
        editorial_headline: editorialHeadline,
        editorial_summary: editorialSummary,
        editorial_content: editorialContent,
        source_content: sourceContent,
        content_variants: contentVariants,
        status: selectedDestinations.length > 0 ? "approved" : "approved_for_editing",
        last_scraped_at: sourceContent ? new Date().toISOString() : newsItem.last_scraped_at,
        
        // Add new metadata fields
        primary_author_id: articleMetadata.authorId || null,
        template_type: articleMetadata.templateType || null,
        source_attribution: articleMetadata.sourceAttribution || null,
        byline_text: articleMetadata.bylineText || null
      };

      if (selectedDestinations.length > 0) {
        updateData.destinations = [...selectedDestinations, "website"];
      }

      const { error } = await supabase
        .from('news')
        .update(updateData)
        .eq('id', newsItem.id);

      if (error) throw error;

      toast.success(selectedDestinations.length > 0 ? "Article saved and routed for publication" : "Article enhanced and saved");
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
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Editorial Enhancement</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{newsItem.source}</Badge>
            <Button variant="ghost" size="sm" onClick={() => window.open(newsItem.url, '_blank')}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Enhance this news item before routing to publication channels
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="source" className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b bg-background">
            <TabsTrigger value="source">Source Data</TabsTrigger>
            <TabsTrigger value="editorial">Editorial Content</TabsTrigger>
            <TabsTrigger value="metadata">Article Metadata</TabsTrigger>
            <TabsTrigger value="routing">Publication Routing</TabsTrigger>
          </TabsList>

          <TabsContent value="source" className="flex-1 overflow-y-auto p-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Original Source Information</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={scrapeArticleContent}
                    disabled={isScrapingContent}
                  >
                    {isScrapingContent ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Scraping...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Scrape Article
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Original Title</label>
                  <Input
                    value={originalTitle}
                    onChange={(e) => setOriginalTitle(e.target.value)}
                    placeholder="Original article title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Author
                    </label>
                    <Input
                      value={originalAuthor}
                      onChange={(e) => setOriginalAuthor(e.target.value)}
                      placeholder="Article author"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Publication Date
                    </label>
                    <Input
                      type="datetime-local"
                      value={originalPublicationDate ? new Date(originalPublicationDate).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setOriginalPublicationDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Source Content</label>
                  <Textarea
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    placeholder="Paste or scrape the full article content here"
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    This preserves the original content for reference and AI processing
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="editorial" className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Editorial Headline</label>
              <Input
                value={editorialHeadline}
                onChange={(e) => setEditorialHeadline(e.target.value)}
                placeholder="Enhanced headline for publication"
                className="text-lg font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Editorial Summary</label>
              <Textarea
                value={editorialSummary}
                onChange={(e) => setEditorialSummary(e.target.value)}
                placeholder="Enhanced summary for publication"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Editorial Content</label>
              <Textarea
                value={editorialContent}
                onChange={(e) => setEditorialContent(e.target.value)}
                placeholder="Full editorial article content (if creating original content)"
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Optional: Use this for completely rewritten or original content
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Editorial Notes</label>
              <Textarea
                value={editorialNotes}
                onChange={(e) => setEditorialNotes(e.target.value)}
                placeholder="Internal notes about this story (not published)"
                rows={3}
              />
            </div>

            {newsItem.matched_clusters && newsItem.matched_clusters.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Matched Topics</label>
                <div className="flex flex-wrap gap-2">
                  {newsItem.matched_clusters.map((cluster, index) => (
                    <Badge key={index} variant="secondary">
                      {cluster}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="metadata" className="flex-1 overflow-y-auto p-4">
            <ArticleMetadataForm
              authorId={articleMetadata.authorId}
              templateType={articleMetadata.templateType}
              sourceAttribution={articleMetadata.sourceAttribution}
              contentComplexityScore={articleMetadata.contentComplexityScore}
              bylineText={articleMetadata.bylineText}
              onMetadataChange={handleMetadataChange}
            />
          </TabsContent>

          <TabsContent value="routing" className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-3">Select Publication Destinations</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <input
                      type="checkbox"
                      id="mpdaily"
                      checked={selectedDestinations.includes("mpdaily")}
                      onChange={() => handleDestinationToggle("mpdaily")}
                      className="rounded"
                    />
                    <div className="flex items-center gap-2">
                      <Newspaper className="h-4 w-4" />
                      <label htmlFor="mpdaily" className="font-medium">MPDaily</label>
                    </div>
                    <p className="text-sm text-muted-foreground ml-auto">Daily email newsletter</p>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <input
                      type="checkbox"
                      id="magazine"
                      checked={selectedDestinations.includes("magazine")}
                      onChange={() => handleDestinationToggle("magazine")}
                      className="rounded"
                    />
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      <label htmlFor="magazine" className="font-medium">Magazine</label>
                    </div>
                    <p className="text-sm text-muted-foreground ml-auto">Monthly publication</p>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      className="rounded"
                    />
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span className="font-medium">Website</span>
                    </div>
                    <p className="text-sm text-muted-foreground ml-auto">Always included</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  You can save enhancements without selecting destinations, or choose destinations to route for publication.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="border-t p-4 flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Enhancements
              </>
            )}
          </Button>
          {selectedDestinations.length > 0 && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Processing..." : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Save & Route for Publication
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
