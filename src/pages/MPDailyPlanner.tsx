
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Article {
  id: string;
  title: string;
  content_variants: any;
  status: string | null;
  created_at: string;
  destinations: string[];
  source_news_id: string;
  published_at: string | null;
}

const MPDailyPlanner = () => {
  const [viewMode, setViewMode] = useState<"list" | "schedule">("list");

  const { data: articles, isLoading, error, refetch } = useQuery({
    queryKey: ['articles', 'mpdaily'],
    queryFn: async () => {
      console.log("Fetching MPDaily articles");
      
      // Try two different queries to ensure we catch all relevant articles
      const { data: destinationData, error: destinationError } = await supabase
        .from('articles')
        .select('*')
        .contains('destinations', ['mpdaily'])
        .order('created_at', { ascending: false });
      
      if (destinationError) {
        console.error("Error fetching MPDaily articles by destination:", destinationError);
        throw new Error(destinationError.message);
      }
      
      // Also check for articles with status containing 'mpdaily'
      const { data: statusData, error: statusError } = await supabase
        .from('articles')
        .select('*')
        .ilike('status', '%mpdaily%')
        .order('created_at', { ascending: false });
      
      if (statusError) {
        console.error("Error fetching MPDaily articles by status:", statusError);
        throw new Error(statusError.message);
      }
      
      // Combine results, removing duplicates by ID
      const combinedResults = [...(destinationData || [])];
      
      if (statusData) {
        statusData.forEach(statusItem => {
          if (!combinedResults.some(item => item.id === statusItem.id)) {
            combinedResults.push(statusItem);
          }
        });
      }
      
      console.log("MPDaily articles fetched:", combinedResults);
      return combinedResults as Article[];
    }
  });

  const handlePublish = async (id: string) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ 
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success("Article published successfully");
      refetch();
    } catch (err) {
      console.error("Error publishing article:", err);
      toast.error("Failed to publish article");
    }
  };

  const getArticleStatusColor = (status: string | null) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'queued':
      case 'queued_mpdaily':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
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
            <p className="text-muted-foreground">Loading articles...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md">
            <p>Error loading articles. Please try refreshing.</p>
          </div>
        ) : (
          <>
            <TabsContent value="list">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles && articles.length > 0 ? (
                  articles.map((article) => (
                    <Card key={article.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <Badge className={getArticleStatusColor(article.status)}>
                            {article.status === 'published' ? 'Published' : 
                             article.status === 'queued_mpdaily' ? 'Queued' :
                             article.status || 'Draft'}
                          </Badge>
                          {article.published_at && (
                            <span className="text-xs text-muted-foreground">
                              Published: {new Date(article.published_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <CardTitle className="text-lg">{article.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          {article.content_variants?.summary 
                            ? article.content_variants.summary.substring(0, 100) + '...'
                            : 'No summary available'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(article.created_at).toLocaleDateString()}
                        </p>
                        <div className="mt-4 flex justify-end space-x-2">
                          <Button variant="outline" size="sm">Edit</Button>
                          <Button 
                            variant="default" 
                            size="sm"
                            disabled={article.status === 'published'}
                            onClick={() => article.status !== 'published' && handlePublish(article.id)}
                          >
                            {article.status === 'published' ? 'Published' : 'Publish'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-3 bg-muted/50 rounded-md p-8 text-center">
                    <h3 className="text-xl font-semibold mb-2">No articles for MPDaily</h3>
                    <p className="text-muted-foreground">
                      There are no articles currently assigned to MPDaily. 
                      Approve some articles from Today's Briefing.
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
    </DashboardLayout>
  );
};

export default MPDailyPlanner;
