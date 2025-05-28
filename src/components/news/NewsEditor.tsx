
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
  Globe 
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
  const [headline, setHeadline] = useState(newsItem.headline || '');
  const [summary, setSummary] = useState(newsItem.summary || '');
  const [editorialNotes, setEditorialNotes] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [isFetchingContent, setIsFetchingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);

  useEffect(() => {
    // Load existing content variants if available
    if (newsItem.content_variants?.editorial_content) {
      setHeadline(newsItem.content_variants.editorial_content.headline || newsItem.headline);
      setSummary(newsItem.content_variants.editorial_content.summary || newsItem.summary);
    }
    if (newsItem.content_variants?.source_content?.full_content) {
      setSourceContent(newsItem.content_variants.source_content.full_content);
    }
    if (newsItem.content_variants?.metadata?.editorial_notes) {
      setEditorialNotes(newsItem.content_variants.metadata.editorial_notes);
    }
  }, [newsItem]);

  const fetchSourceContent = async () => {
    setIsFetchingContent(true);
    try {
      // In a real implementation, you'd fetch the actual content from the URL
      // For now, we'll simulate this with a placeholder
      toast.info("Fetching source content...");
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockContent = `This is the full article content from ${newsItem.source}. 

The article discusses the topics mentioned in the summary: ${newsItem.summary}

In a real implementation, this would be the actual scraped content from the source URL: ${newsItem.url}

This content would be processed and cleaned to remove ads, navigation, and other non-article elements.`;

      setSourceContent(mockContent);
      toast.success("Source content fetched successfully");
    } catch (error) {
      console.error("Error fetching source content:", error);
      toast.error("Failed to fetch source content");
    } finally {
      setIsFetchingContent(false);
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
          original_title: newsItem.headline,
          original_summary: newsItem.summary,
          full_content: sourceContent,
          source_url: newsItem.url,
          fetched_at: new Date().toISOString()
        },
        editorial_content: {
          headline: headline,
          summary: summary,
          enhanced_at: new Date().toISOString()
        },
        metadata: {
          editorial_notes: editorialNotes,
          workflow_stage: selectedDestinations.length > 0 ? "ready_for_publication" : "enhanced"
        }
      };

      const updateData: any = {
        content_variants: contentVariants,
        status: selectedDestinations.length > 0 ? "approved" : "approved_for_editing"
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
        <Tabs defaultValue="content" className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b bg-background">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="source">Source Material</TabsTrigger>
            <TabsTrigger value="routing">Publication Routing</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Editorial Headline</label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Enhanced headline for publication"
                className="text-lg font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Editorial Summary</label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Enhanced summary for publication"
                rows={4}
              />
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

          <TabsContent value="source" className="flex-1 overflow-y-auto p-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Original Source Content</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSourceContent}
                    disabled={isFetchingContent}
                  >
                    {isFetchingContent ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      "Fetch Full Article"
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sourceContent ? (
                  <Textarea
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    placeholder="Full article content will appear here"
                    rows={15}
                    className="font-mono text-sm"
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="mb-2">No source content fetched yet</p>
                    <p className="text-sm">Click "Fetch Full Article" to retrieve the original content</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
