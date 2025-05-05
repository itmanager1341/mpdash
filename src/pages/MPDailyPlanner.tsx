
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

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  status: string | null;
  created_at?: string;
  timestamp: string;
  destinations: string[];
  source: string;
  matched_clusters?: string[];
  url: string;
}

const MPDailyPlanner = () => {
  const [viewMode, setViewMode] = useState<"list" | "schedule">("list");

  const { data: newsItems, isLoading, error, refetch } = useQuery({
    queryKey: ['news', 'mpdaily'],
    queryFn: async () => {
      console.log("Fetching MPDaily news items");
      
      // Query news items that have been approved for MPDaily
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .or('status.ilike.%mpdaily%,destinations.cs.{mpdaily}')
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
          status: 'published',
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

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-blue-100 text-blue-800 border-blue-200';
    
    if (status.includes('published')) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (status.includes('queued')) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    
    return 'bg-blue-100 text-blue-800 border-blue-200';
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
                  newsItems.map((item) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <Badge className={getStatusColor(item.status)}>
                            {item.status === 'published' ? 'Published' : 
                             item.status?.includes('queued') ? 'Queued' :
                             item.status || 'Draft'}
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
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(item.url, '_blank')}
                          >
                            View Source
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm"
                            disabled={item.status === 'published'}
                            onClick={() => item.status !== 'published' && handlePublish(item.id)}
                          >
                            {item.status === 'published' ? 'Published' : 'Publish'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
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
    </DashboardLayout>
  );
};

export default MPDailyPlanner;
