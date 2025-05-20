
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Edit, List, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import DraftEditor from "@/components/editor/DraftEditor";
import { NewsItem } from "@/types/news";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const MPDailyPlanner = () => {
  const [viewMode, setViewMode] = useState<"list" | "schedule">("list");
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [isDraftEditorOpen, setIsDraftEditorOpen] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const { data: newsItems, isLoading, error, refetch } = useQuery({
    queryKey: ['news', 'mpdaily'],
    queryFn: async () => {
      console.log("Fetching MPDaily news items");
      
      // Query news items that have been approved for MPDaily
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('status', 'approved')
        .contains('destinations', ['mpdaily'])
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error("Error fetching MPDaily news items:", error);
        throw new Error(error.message);
      }
      
      console.log("MPDaily news items fetched:", data);
      return data as NewsItem[];
    }
  });

  const handlePublish = async (id: string) => {
    try {
      // With our simplified schema, we just update the content_variants
      const { error } = await supabase
        .from('news')
        .update({ 
          content_variants: {
            ...selectedItem?.content_variants,
            published: true
          }
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success("Item published successfully");
      refetch();
    } catch (err) {
      console.error("Error publishing item:", err);
      toast.error("Failed to publish item");
    }
  };

  const openDraftEditor = (item: NewsItem) => {
    setSelectedItem(item);
    setIsDraftEditorOpen(true);
  };

  const handleGenerateContent = async () => {
    if (!aiPrompt) {
      toast.warning("Please enter a prompt for content generation");
      return;
    }
    
    toast.info("Generating content...", { duration: 2000 });
    
    try {
      // Call the Supabase edge function to generate content
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `Create a concise email newsletter item about: ${aiPrompt}
          
Format your response with:
1. An engaging headline (maximum 10 words)
2. A brief summary (3-4 sentences maximum)
3. A bulleted list of 2-3 key points
4. A short call-to-action`,
          model: 'gpt-4o-mini',
          input_data: {
            topic: aiPrompt
          }
        }
      });
      
      if (error) throw error;
      
      // Create a dummy news item with the generated content
      setSelectedItem({
        id: 'temp-' + Date.now(),
        headline: `AI-Generated: ${aiPrompt.slice(0, 30)}${aiPrompt.length > 30 ? '...' : ''}`,
        summary: typeof data.output === 'string' 
          ? data.output.slice(0, 150) 
          : JSON.stringify(data.output).slice(0, 150),
        content_variants: {
          title: `AI-Generated: ${aiPrompt.slice(0, 30)}${aiPrompt.length > 30 ? '...' : ''}`,
          summary: typeof data.output === 'string' 
            ? data.output 
            : JSON.stringify(data.output)
        },
        timestamp: new Date().toISOString(),
        source: 'AI Generated',
        url: '',
        destinations: ['mpdaily']
      });
      
      setIsDraftEditorOpen(true);
      setShowAiAssistant(false);
      setAiPrompt("");
    } catch (err) {
      console.error('Error generating content:', err);
      toast.error("Failed to generate content");
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">MPDaily Planner</h1>
            <p className="text-muted-foreground">
              Plan and organize content for the daily email newsletter
            </p>
          </div>
          <div className="flex gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "schedule")}>
              <TabsList>
                <TabsTrigger value="list">
                  <List className="h-4 w-4 mr-2" />
                  List View
                </TabsTrigger>
                <TabsTrigger value="schedule">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button 
              variant="outline" 
              className="ml-2 flex items-center gap-2"
              onClick={() => setShowAiAssistant(true)}
            >
              <Lightbulb className="h-4 w-4" />
              AI Assistant
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={viewMode}>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-muted-foreground">Loading content...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md">
            <p>Error loading content. Please try refreshing.</p>
          </div>
        ) : (
          <>
            <TabsContent value="list">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {newsItems && newsItems.length > 0 ? (
                  newsItems.map((item) => {
                    const hasPublished = item.content_variants?.published;
                    const hasDraft = item.content_variants?.title || item.content_variants?.summary;
                    
                    return (
                      <Card key={item.id} variant="elevated" className="overflow-hidden h-[280px] flex flex-col">
                        <CardHeader className="pb-0">
                          <CardTitle className="text-lg mb-2 line-clamp-2">
                            {item.content_variants?.title || item.headline}
                          </CardTitle>
                        </CardHeader>
                        
                        <CardContent className="flex flex-col flex-grow justify-between pt-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                              {item.content_variants?.summary || item.summary || 'No summary available'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Source: {item.source} | Date: {new Date(item.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                          
                          <div className="mt-4 flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(item.url, '_blank')}
                            >
                              View Source
                            </Button>
                            
                            {!hasDraft && (
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => openDraftEditor(item)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Write Draft
                              </Button>
                            )}
                            
                            {(hasDraft && !hasPublished) && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openDraftEditor(item)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Draft
                                </Button>
                                
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => handlePublish(item.id)}
                                >
                                  Publish
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="col-span-3 bg-muted/50 rounded-md p-8 text-center">
                    <h3 className="text-xl font-semibold mb-2">No content for MPDaily</h3>
                    <p className="text-muted-foreground">
                      There are no items currently approved for MPDaily. 
                      Approve some items from Today's Briefing.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <CardTitle>Publication Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-8 text-center">
                    <p className="text-muted-foreground">
                      Calendar scheduling view will be implemented in a future update.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Draft Editor */}
      {selectedItem && (
        <DraftEditor
          newsItem={selectedItem}
          open={isDraftEditorOpen}
          onOpenChange={setIsDraftEditorOpen}
          onSave={refetch}
        />
      )}
      
      {/* AI Assistant Dialog */}
      <Dialog open={showAiAssistant} onOpenChange={setShowAiAssistant}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>AI Content Assistant</DialogTitle>
            <DialogDescription>
              Generate newsletter content using AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="ai-prompt" className="text-sm font-medium mb-2 block">
                What would you like to create content about?
              </label>
              <textarea 
                id="ai-prompt" 
                className="min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                placeholder="e.g., 'Create a newsletter item about recent changes to mortgage interest rates'"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </div>
            
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setShowAiAssistant(false)}>
                Cancel
              </Button>
              <Button 
                variant="default" 
                onClick={handleGenerateContent}
                disabled={!aiPrompt}
              >
                Generate Content
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MPDailyPlanner;
