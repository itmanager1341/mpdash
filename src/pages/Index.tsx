
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import ArticleApproval from "@/components/news/ArticleApproval";

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  perplexity_score: number;
  is_competitor_covered: boolean;
  matched_clusters: string[];
  timestamp: string;
  status: string | null;
}

const Index = () => {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { data: newsItems, isLoading, error, refetch } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .is('status', null) // Only fetch items that haven't been processed yet
        .order('perplexity_score', { ascending: false })
        .limit(10);
      
      if (error) throw new Error(error.message);
      return data as NewsItem[];
    }
  });

  const openDetailView = (item: NewsItem) => {
    setSelectedItem(item);
    setIsSheetOpen(true);
  };

  const handleDismiss = async (item: NewsItem) => {
    try {
      // Update the news item status in Supabase
      const { error: updateError } = await supabase
        .from('news')
        .update({ status: 'dismissed' })
        .eq('id', item.id);
      
      if (updateError) throw updateError;
      
      toast.success("Article dismissed");
      refetch(); // Refresh the data
    } catch (err) {
      console.error("Error dismissing article:", err);
      toast.error("Failed to dismiss article");
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Today's Briefing</h1>
        <div>
          <p className="text-muted-foreground">
            AI-curated article suggestions based on trending topics and keyword clusters
          </p>
        </div>
      </div>
      
      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <p className="text-muted-foreground">Loading suggestions...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <p>Error loading content suggestions. Please try refreshing.</p>
        </div>
      )}

      {newsItems?.length === 0 && !isLoading && !error && (
        <div className="bg-muted/50 rounded-md p-8 text-center">
          <h3 className="text-xl font-semibold mb-2">No pending articles</h3>
          <p className="text-muted-foreground">All articles have been processed or no new articles are available.</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {newsItems?.map((item) => (
          <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start mb-2">
                <Badge variant={item.perplexity_score > 7 ? "default" : "outline"}>
                  Score: {item.perplexity_score?.toFixed(1) || "N/A"}
                </Badge>
                {item.is_competitor_covered && (
                  <Badge variant="secondary">Competitor Covered</Badge>
                )}
              </div>
              <CardTitle className="line-clamp-2 text-lg">{item.headline}</CardTitle>
              <CardDescription className="flex items-center gap-2 text-xs">
                <span>Source: {item.source}</span>
                <span>•</span>
                <span>{new Date(item.timestamp).toLocaleDateString()}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm line-clamp-3">{item.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {item.matched_clusters?.map((cluster, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {cluster}
                  </Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button 
                variant="link" 
                className="w-full justify-start p-0 h-auto" 
                onClick={() => openDetailView(item)}
              >
                View full details
              </Button>
              <div className="flex gap-2 w-full">
                <ArticleApproval 
                  newsItem={item} 
                  onApproved={refetch}
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleDismiss(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Detail view side sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedItem.headline}</SheetTitle>
                <SheetDescription>
                  Source: <a href={selectedItem.url} target="_blank" rel="noopener noreferrer" className="underline">{selectedItem.source}</a>
                </SheetDescription>
              </SheetHeader>
              <div className="py-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Summary</h3>
                    <p className="mt-1">{selectedItem.summary}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Metrics</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="bg-secondary/20 p-3 rounded-md">
                        <p className="text-xs text-muted-foreground">Perplexity Score</p>
                        <p className="text-2xl font-bold">{selectedItem.perplexity_score?.toFixed(1) || "N/A"}</p>
                      </div>
                      <div className="bg-secondary/20 p-3 rounded-md">
                        <p className="text-xs text-muted-foreground">Competitor Cover</p>
                        <p className="text-2xl font-bold">{selectedItem.is_competitor_covered ? "Yes" : "No"}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Matched Clusters</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedItem.matched_clusters?.map((cluster, index) => (
                        <Badge key={index} variant="secondary">
                          {cluster}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 space-y-2">
                <ArticleApproval 
                  newsItem={selectedItem} 
                  onApproved={() => {
                    refetch();
                    setIsSheetOpen(false);
                  }}
                />
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => {
                    handleDismiss(selectedItem);
                    setIsSheetOpen(false);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default Index;
