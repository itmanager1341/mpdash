
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Kanban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Article {
  id: string;
  title: string;
  content_variants: any;
  status: string | null;
  created_at: string;
  destinations: string[];
  source_news_id: string;
}

const MagazinePlanner = () => {
  const [viewMode, setViewMode] = useState<"kanban" | "calendar">("kanban");

  const { data: articles, isLoading, error } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw new Error(error.message);
      return data as Article[];
    }
  });

  const getArticleStatusColor = (status: string | null) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'unpublished':
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

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-muted-foreground">Loading articles...</p>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <p>Error loading articles. Please try refreshing.</p>
        </div>
      ) : (
        <TabsContent value="kanban" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-3 px-2">Unpublished</h2>
              <div className="space-y-3">
                {articles?.filter(a => a.status !== 'published').map((article) => (
                  <Card key={article.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge className={getArticleStatusColor(article.status)}>
                          {article.status || 'Draft'}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{article.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {article.destinations && article.destinations.map((dest) => (
                          <Badge key={dest} variant="outline" className="text-xs">
                            {dest}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end space-x-2">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="default" size="sm">Publish</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {articles?.filter(a => a.status !== 'published').length === 0 && (
                  <div className="bg-muted/50 rounded-md p-4 text-center">
                    <p className="text-sm text-muted-foreground">No unpublished articles</p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-3 px-2">Published</h2>
              <div className="space-y-3">
                {articles?.filter(a => a.status === 'published').map((article) => (
                  <Card key={article.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge className={getArticleStatusColor(article.status)}>
                          Published
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{article.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {article.destinations && article.destinations.map((dest) => (
                          <Badge key={dest} variant="outline" className="text-xs">
                            {dest}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" size="sm">View</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {articles?.filter(a => a.status === 'published').length === 0 && (
                  <div className="bg-muted/50 rounded-md p-4 text-center">
                    <p className="text-sm text-muted-foreground">No published articles</p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-3 px-2">Archive</h2>
              <div className="space-y-3">
                <div className="bg-muted/50 rounded-md p-4 text-center">
                  <p className="text-sm text-muted-foreground">Archived articles will appear here</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      )}

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
    </DashboardLayout>
  );
};

export default MagazinePlanner;
