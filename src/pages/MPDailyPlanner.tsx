
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, List, Lightbulb, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import DraftEditor from "@/components/editor/DraftEditor";
import { UnifiedNewsCard } from "@/components/news/UnifiedNewsCard";
import { NewsItem } from "@/types/news";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
      
      setSelectedItem({
        id: 'temp-' + Date.now(),
        headline: `AI-Generated: ${aiPrompt.slice(0, 30)}${aiPrompt.length > 30 ? '...' : ''}`,
        summary: typeof data.output === 'string' 
          ? data.output.slice(0, 150) 
          : JSON.stringify(data.output).slice(0, 150),
        status: 'draft',
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

  // Create custom action handlers for the unified cards
  const handleCreateDraft = (item: NewsItem) => {
    openDraftEditor(item);
  };

  const handleEditDraft = (item: NewsItem) => {
    openDraftEditor(item);
  };

  const handlePublishItem = (item: NewsItem) => {
    handlePublish(item.id);
  };

  // Enhanced status change handler
  const handleStatusChange = () => {
    refetch();
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
                  Content Queue
                </TabsTrigger>
                <TabsTrigger value="schedule">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button 
              variant="outline" 
              onClick={() => setShowAiAssistant(true)}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
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
              <div className="space-y-4">
                {newsItems && newsItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {newsItems.map((item) => {
                      const hasPublished = item.content_variants?.published;
                      const hasDraft = item.content_variants?.title || item.content_variants?.summary;
                      
                      return (
                        <UnifiedNewsCard
                          key={item.id}
                          newsItem={item}
                          onDetailsClick={(item) => openDraftEditor(item)}
                          onStatusChange={handleStatusChange}
                          showActions={true}
                          className="h-full"
                        />
                      );
                    })
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-md p-8 text-center">
                    <h3 className="text-xl font-semibold mb-2">No content for MPDaily</h3>
                    <p className="text-muted-foreground mb-4">
                      There are no items currently approved for MPDaily. 
                      Approve some items from News Triage to get started.
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => window.location.href = '/'}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Go to News Triage
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="schedule">
              <div className="bg-muted/50 rounded-md p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Publication Schedule</h3>
                <p className="text-muted-foreground">
                  Calendar scheduling view will be implemented in a future update.
                </p>
              </div>
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
              <Textarea 
                id="ai-prompt" 
                className="min-h-24"
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
