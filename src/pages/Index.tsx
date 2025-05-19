
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Filter, Plus, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import ArticleApproval from "@/components/news/ArticleApproval";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  destinations: string[] | null;
}

interface FilterOptions {
  showProcessed: boolean;
  sources: string[];
  minScore: number;
}

const Index = () => {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"pending" | "all">("pending");
  const [filters, setFilters] = useState<FilterOptions>({
    showProcessed: false,
    sources: [],
    minScore: 0
  });

  // Get array of unique sources for filter dropdown
  const { data: sourcesList } = useQuery({
    queryKey: ['news-sources'],
    queryFn: async () => {
      // First, fetch all sources where source is not null
      const { data, error } = await supabase
        .from('news')
        .select('source')
        .not('source', 'is', null)
        .order('source');
      
      if (error) throw new Error(error.message);
      
      // Extract unique sources
      const sources = [...new Set(data.map(item => item.source))];
      return sources as string[];
    }
  });

  // Build query based on filter options and view mode
  const { data: newsItems, isLoading, error, refetch } = useQuery({
    queryKey: ['news', viewMode, filters],
    queryFn: async () => {
      let query = supabase
        .from('news')
        .select('*');
      
      // Apply status filter based on view mode
      if (viewMode === "pending") {
        query = query.is('status', null);
      }
      
      // Apply source filter if any sources are selected
      if (filters.sources.length > 0) {
        query = query.in('source', filters.sources);
      }
      
      // Apply score filter
      if (filters.minScore > 0) {
        query = query.gte('perplexity_score', filters.minScore);
      }
      
      // Always sort by priority (perplexity score) and recency
      const { data, error } = await query.order('perplexity_score', { ascending: false });
      
      if (error) throw new Error(error.message);
      return data as NewsItem[];
    }
  });

  // Function to open the detail view for an item
  const openDetailView = (item: NewsItem) => {
    setSelectedItem(item);
    setIsSheetOpen(true);
  };

  // Function to handle dismissing an article
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

  // Function to toggle a source in the filter
  const toggleSource = (source: string) => {
    setFilters(prev => {
      const newSources = prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source];
      
      return { ...prev, sources: newSources };
    });
  };

  // Function to get appropriate badge variant based on status
  const getStatusBadge = (status: string | null) => {
    if (!status) return { variant: "outline" as const, label: "New" };
    
    if (status.includes("approved")) {
      return { variant: "default" as const, label: "Approved" };
    }
    
    if (status === "dismissed") {
      return { variant: "secondary" as const, label: "Dismissed" };
    }
    
    if (status === "referenced") {
      return { variant: "outline" as const, label: "Reference" };
    }
    
    return { variant: "outline" as const, label: status };
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
      
      <div className="flex justify-between items-center mb-6">
        <Tabs 
          value={viewMode} 
          onValueChange={(value) => setViewMode(value as "pending" | "all")}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="all">All Items</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter by Source</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sourcesList?.map(source => (
                <DropdownMenuCheckboxItem
                  key={source}
                  checked={filters.sources.includes(source)}
                  onCheckedChange={() => toggleSource(source)}
                >
                  {source}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Filter by Score</DropdownMenuLabel>
              <div className="px-2 py-1.5 text-sm">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={filters.minScore}
                  onChange={(e) => setFilters(prev => ({ ...prev, minScore: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>Min: {filters.minScore}</span>
                  <span>10</span>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add News
          </Button>
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
          <h3 className="text-xl font-semibold mb-2">No articles found</h3>
          <p className="text-muted-foreground">
            {viewMode === "pending" 
              ? "No pending articles to review. Try changing filters or adding news manually." 
              : "No articles match your current filters."}
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {newsItems?.map((item) => {
          const statusBadge = getStatusBadge(item.status);
          
          return (
            <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={item.perplexity_score > 7 ? "default" : "outline"}>
                    Score: {item.perplexity_score?.toFixed(1) || "N/A"}
                  </Badge>
                  <div className="flex gap-1">
                    {item.status && (
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                    )}
                    {item.is_competitor_covered && (
                      <Badge variant="secondary">Competitor Covered</Badge>
                    )}
                  </div>
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
                  {!item.status || item.status === "suggested" ? (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDismiss(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </CardFooter>
            </Card>
          );
        })}
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
                    <h3 className="text-sm font-medium">Status</h3>
                    <div className="mt-2">
                      {selectedItem.status ? (
                        <Badge variant={getStatusBadge(selectedItem.status).variant} className="text-sm">
                          {getStatusBadge(selectedItem.status).label}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-sm">New</Badge>
                      )}
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
                
                {!selectedItem.status || selectedItem.status === "suggested" ? (
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
                ) : null}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default Index;
