
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, List, Lightbulb, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ImprovedDraftEditor from "@/components/editor/ImprovedDraftEditor";
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
          prompt_text: `Create a comprehensive newsletter article about: ${aiPrompt}

Structure your response as a complete article with:
1. A compelling, marketing-optimized headline (8-12 words)
2. A concise editorial summary (2-3 sentences for reference/SEO)
3. A compelling call-to-action teaser (1-2 sentences that create curiosity)
4. Full article content (400-600 words, formatted with proper paragraphs)

Focus on relevance to mortgage industry professionals and include actionable insights.`,
          model: 'gpt-4o',
          input_data: {
            topic: aiPrompt
          }
        }
      });
      
      if (error) throw error;
      
      const generatedContent = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      const lines = generatedContent.split('\n').filter(line => line.trim());
      const headline = lines[0] || `AI-Generated: ${aiPrompt.slice(0, 30)}...`;
      
      setSelectedItem({
        id: 'temp-' + Date.now(),
        headline: headline,
        summary: `AI-generated content about ${aiPrompt}`,
        status: 'draft',
        content_variants: {
          source_content: {
            original_title: headline,
            original_summary: `AI-generated content about ${aiPrompt}`,
            author: 'AI Assistant',
            publication_date: new Date().toISOString()
          },
          editorial_content: {
            headline: headline,
            summary: `AI-generated content about ${aiPrompt}`,
            cta: "Discover what this means for your business...",
            full_content: generatedContent
          },
          metadata: {
            seo_title: headline,
            seo_description: `AI-generated content about ${aiPrompt}`.slice(0, 160),
            tags: ['ai-generated']
          },
          status: 'draft'
        },
        timestamp: new Date().toISOO(),
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

  const handleStatusChange = () => {
    refetch();
  };

  const getEditorialStatus = (item: NewsItem) => {
    const editorialContent = item.content_variants?.editorial_content;
    const status = item.content_variants?.status;
    
    if (status === 'published') return 'Published';
    if (status === 'ready') return 'Ready to Publish';
    if (editorialContent?.headline && editorialContent?.full_content) return 'Draft Ready';
    if (editorialContent?.headline) return 'In Progress';
    return 'Needs Editing';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Published': return 'bg-green-100 text-green-800';
      case 'Ready to Publish': return 'bg-blue-100 text-blue-800';
      case 'Draft Ready': return 'bg-yellow-100 text-yellow-800';
      case 'In Progress': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">MPDaily Planner</h1>
            <p className="text-muted-foreground">
              Create and manage content for the daily email newsletter
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
                      const editorialStatus = getEditorialStatus(item);
                      
                      return (
                        <div key={item.id} className="relative">
                          <UnifiedNewsCard
                            newsItem={{
                              ...item,
                              headline: item.content_variants?.editorial_content?.headline || item.headline,
                              summary: item.content_variants?.editorial_content?.summary || item.summary
                            }}
                            onDetailsClick={() => openDraftEditor(item)}
                            onStatusChange={handleStatusChange}
                            showActions={true}
                            className="h-full"
                          />
                          <div className="absolute top-2 right-2">
                            <div className={`text-xs px-2 py-1 rounded ${getStatusColor(editorialStatus)}`}>
                              {editorialStatus}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

      {/* Improved Draft Editor */}
      {selectedItem && (
        <ImprovedDraftEditor
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
              Generate complete newsletter content using AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="ai-prompt" className="text-sm font-medium mb-2 block">
                What topic would you like to create content about?
              </label>
              <Textarea 
                id="ai-prompt" 
                className="min-h-24"
                placeholder="e.g., 'Recent changes to mortgage interest rates and their impact on borrowers'"
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
