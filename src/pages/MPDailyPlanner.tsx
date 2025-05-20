
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Edit, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import DraftEditor from "@/components/editor/DraftEditor";

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  status: string;
  content_variants?: any;
  created_at?: string;
  timestamp: string;
  source: string;
  matched_clusters?: string[];
  url: string;
  destinations: string[] | null;
}

const MPDailyPlanner = () => {
  const [viewMode, setViewMode] = useState<"list" | "schedule">("list");
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [isDraftEditorOpen, setIsDraftEditorOpen] = useState(false);

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
      // With our simplified schema, we don't change the status when publishing
      // We just update any content if needed
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

  const getDraftStatus = (item: NewsItem) => {
    if (item.content_variants?.published) {
      return { color: 'bg-green-100 text-green-800 border-green-200', label: 'Published' };
    }
    if (item.content_variants?.title || item.content_variants?.summary) {
      return { color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Draft Ready' };
    }
    return { color: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Approved' };
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
                    const draftStatus = getDraftStatus(item);
                    
                    return (
                      <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <Badge className={draftStatus.color}>
                              {draftStatus.label}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg">{item.content_variants?.title || item.headline}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            {item.content_variants?.summary || item.summary?.substring(0, 100) + '...' || 'No summary available'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Source: {item.source} | Date: {new Date(item.timestamp).toLocaleDateString()}
                          </p>
                          <div className="mt-4 flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(item.url, '_blank')}
                            >
                              View Source
                            </Button>
                            
                            {!item.content_variants?.title && (
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => openDraftEditor(item)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Write Draft
                              </Button>
                            )}
                            
                            {(item.content_variants?.title && !item.content_variants?.published) && (
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
                            
                            {item.content_variants?.published && (
                              <Badge variant="outline">Published</Badge>
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
    </DashboardLayout>
  );
};

export default MPDailyPlanner;
