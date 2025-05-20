
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Kanban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  status: string;
  created_at?: string; 
  timestamp: string;
  source: string;
  url: string;
  matched_clusters?: string[];
  destinations: string[] | null;
  content_variants?: any;
}

const MagazinePlanner = () => {
  const [viewMode, setViewMode] = useState<"kanban" | "calendar">("kanban");

  const { data: newsItems, isLoading, error, refetch } = useQuery({
    queryKey: ['magazine-news'],
    queryFn: async () => {
      console.log("Fetching Magazine news items");
      
      // Fetch news items for magazine destination only
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('status', 'approved')
        .contains('destinations', ['magazine'])
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error("Error fetching Magazine news items:", error);
        throw new Error(error.message);
      }
      
      console.log("Magazine news items fetched:", data);
      return data as NewsItem[];
    }
  });

  const handlePublish = async (newsId: string) => {
    try {
      const { error } = await supabase
        .from('news')
        .update({ 
          content_variants: {
            ...(newsItems?.find(item => item.id === newsId)?.content_variants || {}),
            published: true
          }
        })
        .eq('id', newsId);
        
      if (error) throw error;
      
      toast.success("Item published successfully");
      refetch();
    } catch (err) {
      console.error('Error publishing item:', err);
      toast.error("Failed to publish item");
    }
  };

  // Function to determine item workflow stage based on content_variants
  const getItemStage = (item: NewsItem): "planning" | "draft" | "published" => {
    if (item.content_variants?.published) {
      return "published";
    }
    if (item.content_variants?.full_content || item.content_variants?.magazine_content) {
      return "draft";
    }
    return "planning";
  };

  // Group items by their workflow stage
  const planningStageItems = newsItems?.filter(item => getItemStage(item) === "planning") || [];
  const draftStageItems = newsItems?.filter(item => getItemStage(item) === "draft") || [];
  const publishedStageItems = newsItems?.filter(item => getItemStage(item) === "published") || [];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Magazine Planner</h1>
            <p className="text-muted-foreground">
              Plan and organize content for the monthly magazine
            </p>
          </div>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "kanban" | "calendar")}>
            <TabsList>
              <TabsTrigger value="kanban">
                <Kanban className="h-4 w-4 mr-2" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <Calendar className="h-4 w-4 mr-2" />
                Calendar
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Tabs value={viewMode}>
        <TabsContent value="kanban" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-3 px-2">Planning</h2>
              <div className="space-y-3">
                {planningStageItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          Planning
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{item.headline}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {item.summary 
                          ? item.summary.substring(0, 100) + '...'
                          : 'No summary available'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Source: {item.source} | Date: {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                      <div className="mt-4 flex justify-end space-x-2">
                        <Button variant="outline" size="sm" onClick={() => window.open(item.url, '_blank')}>
                          View Source
                        </Button>
                        <Button variant="default" size="sm">
                          Create Brief
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {planningStageItems.length === 0 && (
                  <div className="bg-muted/50 rounded-md p-4 text-center">
                    <p className="text-sm text-muted-foreground">No articles in planning stage</p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-3 px-2">Draft</h2>
              <div className="space-y-3">
                {draftStageItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                          Draft Ready
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{item.headline}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {item.summary 
                          ? item.summary.substring(0, 100) + '...'
                          : 'No summary available'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Source: {item.source} | Date: {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                      <div className="mt-4 flex justify-end space-x-2">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handlePublish(item.id)}
                        >
                          Publish
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {draftStageItems.length === 0 && (
                  <div className="bg-muted/50 rounded-md p-4 text-center">
                    <p className="text-sm text-muted-foreground">No drafted articles</p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-3 px-2">Published</h2>
              <div className="space-y-3">
                {publishedStageItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          Published
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{item.headline}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {item.summary 
                          ? item.summary.substring(0, 100) + '...'
                          : 'No summary available'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Source: {item.source} | Date: {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" size="sm">View</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {publishedStageItems.length === 0 && (
                  <div className="bg-muted/50 rounded-md p-4 text-center">
                    <p className="text-sm text-muted-foreground">No published articles</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="calendar" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Publication Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center">
                <p className="text-muted-foreground">
                  Calendar view will be implemented in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default MagazinePlanner;
