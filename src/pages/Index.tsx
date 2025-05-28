import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Filter, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AddNewsDialog from "@/components/news/AddNewsDialog";
import { Badge } from "@/components/ui/badge";
import { UnifiedNewsCard } from "@/components/news/UnifiedNewsCard";
import { NewsEditor } from "@/components/news/NewsEditor";
import { NewsItem } from "@/types/news";

interface FilterOptions {
  sources: string[];
  minScore: number;
  clusters: string[];
}

const Index = () => {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditingOpen, setIsEditingOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"pending" | "approved_editing" | "all">("pending");
  const [isAddNewsDialogOpen, setIsAddNewsDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    sources: [],
    minScore: 0,
    clusters: []
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
  
  // Fetch all keyword clusters for filtering
  const { data: clustersList } = useQuery({
    queryKey: ['clusters-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('primary_theme, sub_theme')
        .order('primary_theme')
        .order('sub_theme');
      
      if (error) throw new Error(error.message);
      
      // Format clusters as "Primary: Subtheme"
      return data.map(c => `${c.primary_theme}: ${c.sub_theme}`);
    }
  });

  // Simplified news query
  const { data: newsItems, isLoading, error, refetch } = useQuery({
    queryKey: ['news-unified', viewMode, filters],
    queryFn: async () => {
      let query = supabase.from('news').select('*');
      
      if (viewMode === "pending") {
        query = query.eq('status', 'pending');
      } else if (viewMode === "approved_editing") {
        query = query.eq('status', 'approved_for_editing');
      }
      
      if (filters.sources.length > 0) {
        query = query.in('source', filters.sources);
      }
      
      if (filters.minScore > 0) {
        query = query.gte('perplexity_score', filters.minScore);
      }
      
      if (filters.clusters.length > 0) {
        query = query.overlaps('matched_clusters', filters.clusters);
      }
      
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

  // Simplified dismiss handler
  const handleDismiss = async (item: NewsItem) => {
    try {
      const { error } = await supabase
        .from('news')
        .update({ status: 'dismissed', destinations: [] })
        .eq('id', item.id);
      
      if (error) throw error;
      
      toast.success("Article dismissed");
      refetch();
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
  
  // Function to toggle a cluster in the filter
  const toggleCluster = (cluster: string) => {
    setFilters(prev => {
      const newClusters = prev.clusters.includes(cluster)
        ? prev.clusters.filter(c => c !== cluster)
        : [...prev.clusters, cluster];
      
      return { ...prev, clusters: newClusters };
    });
  };

  const handleAddNewsSuccess = () => {
    setIsAddNewsDialogOpen(false);
    refetch();
    toast.success("News item added successfully");
  };
  
  // Function to analyze keywords using AI
  const analyzeNewsKeywords = async () => {
    setIsAnalyzing(true);
    toast.info("Analyzing current news items for keyword clusters...");
    
    try {
      // Call the edge function to analyze news items and update clusters
      const { data, error } = await supabase.functions.invoke('analyze-news-clusters', {
        body: { parameters: { source: "content_analysis" } }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`${data.updated} news items updated with cluster mapping`);
        refetch();
      } else {
        toast.warning("No updates were made. All items may already be analyzed.");
      }
    } catch (err) {
      console.error("Error analyzing keywords:", err);
      toast.error("Failed to analyze news items: " + (err.message || "Unknown error"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEditClick = (item: NewsItem) => {
    setEditingItem(item);
    setIsEditingOpen(true);
  };

  const handleEditSave = () => {
    setIsEditingOpen(false);
    setEditingItem(null);
    refetch();
  };

  const handleEditCancel = () => {
    setIsEditingOpen(false);
    setEditingItem(null);
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">News Workflow</h1>
        <p className="text-muted-foreground">
          Review, enhance, and route content through the editorial workflow
        </p>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "pending" | "approved_editing" | "all")}>
          <TabsList>
            <TabsTrigger value="pending">Pending Review</TabsTrigger>
            <TabsTrigger value="approved_editing">Ready for Enhancement</TabsTrigger>
            <TabsTrigger value="all">All Content</TabsTrigger>
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
              <DropdownMenuLabel>Filter by Cluster</DropdownMenuLabel>
              <div className="max-h-[200px] overflow-y-auto">
                {clustersList?.map(cluster => (
                  <DropdownMenuCheckboxItem
                    key={cluster}
                    checked={filters.clusters.includes(cluster)}
                    onCheckedChange={() => toggleCluster(cluster)}
                  >
                    {cluster}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
              
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
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={analyzeNewsKeywords}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze Clusters
              </>
            )}
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setIsAddNewsDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add News
          </Button>
        </div>
      </div>
      
      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <p className="text-muted-foreground">Loading content...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <p>Error loading content. Please try refreshing.</p>
        </div>
      )}

      {newsItems?.length === 0 && !isLoading && !error && (
        <div className="bg-muted/50 rounded-md p-8 text-center">
          <h3 className="text-xl font-semibold mb-2">No content found</h3>
          <p className="text-muted-foreground">
            {viewMode === "pending" 
              ? "No pending content to review. Try adjusting filters or adding content manually." 
              : "No content matches your current filters."}
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {newsItems?.map((item) => (
          <UnifiedNewsCard 
            key={item.id}
            newsItem={item}
            onDismiss={handleDismiss}
            onDetailsClick={(item) => {
              setSelectedItem(item);
              setIsSheetOpen(true);
            }}
            onEditClick={handleEditClick}
            onStatusChange={refetch}
          />
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
                    <h3 className="text-sm font-medium">Status</h3>
                    <div className="mt-2">
                      {selectedItem.status && (
                        <Badge 
                          variant={selectedItem.status === "approved" ? "success" : 
                                  selectedItem.status === "pending" ? "warning" : 
                                  selectedItem.status === "dismissed" ? "outline" : 
                                  selectedItem.status === "drafted_mpdaily" ? "purple" : "outline"} 
                          className="text-sm"
                        >
                          {selectedItem.status.charAt(0).toUpperCase() + selectedItem.status.slice(1)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {selectedItem.destinations && selectedItem.destinations.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium">Destinations</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedItem.destinations.map((destination, index) => (
                          <Badge key={index} variant="secondary" className="capitalize">
                            {destination}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-sm font-medium">Matched Clusters</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedItem.matched_clusters?.map((cluster, index) => (
                        <Badge key={index} variant="secondary">
                          {cluster}
                        </Badge>
                      )) || (
                        <p className="text-sm text-muted-foreground">No clusters matched</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 space-y-2">
                {selectedItem.status === "pending" && (
                  <>
                    <Card variant="outline" className="p-4">
                      <CardContent className="p-0">
                        <h4 className="font-medium mb-2">Change Status</h4>
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="default" 
                            onClick={() => {
                              handleDismiss(selectedItem).then(() => {
                                setIsSheetOpen(false);
                              });
                            }}
                            className="w-full justify-center"
                          >
                            Dismiss Article
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Editorial enhancement sheet */}
      <Sheet open={isEditingOpen} onOpenChange={setIsEditingOpen}>
        <SheetContent className="w-full sm:max-w-4xl">
          {editingItem && (
            <NewsEditor
              newsItem={editingItem}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add News Dialog */}
      <AddNewsDialog
        open={isAddNewsDialogOpen}
        onOpenChange={setIsAddNewsDialogOpen}
        onSuccess={handleAddNewsSuccess}
      />
    </DashboardLayout>
  );
};

export default Index;
