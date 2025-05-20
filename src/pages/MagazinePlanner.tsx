
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Kanban, Search, Lightbulb, PenLine, Calendar as CalendarIcon, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { NewsItem } from "@/types/news";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface KeywordCluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  keywords: string[] | null;
  description: string | null;
}

interface EditorBrief {
  id: string;
  theme: string;
  summary: string | null;
  outline: string | null;
  status: string | null;
  created_at: string | null;
}

const MagazinePlanner = () => {
  const [viewMode, setViewMode] = useState<"kanban" | "calendar">("kanban");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [selectedCluster, setSelectedCluster] = useState<string>("");

  // Query for news items
  const { data: newsItems, isLoading: newsLoading, error: newsError, refetch: refetchNews } = useQuery({
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
      
      return data as NewsItem[];
    }
  });
  
  // Query for editor briefs
  const { data: editorBriefs, isLoading: briefsLoading, refetch: refetchBriefs } = useQuery({
    queryKey: ['editor-briefs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('editor_briefs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Error fetching editor briefs:", error);
        throw new Error(error.message);
      }
      
      return data as EditorBrief[];
    }
  });
  
  // Query for keyword clusters
  const { data: keywordClusters, isLoading: clustersLoading } = useQuery({
    queryKey: ['keyword-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('*')
        .order('primary_theme', { ascending: true });
      
      if (error) {
        console.error("Error fetching keyword clusters:", error);
        throw new Error(error.message);
      }
      
      return data as KeywordCluster[];
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
      refetchNews();
    } catch (err) {
      console.error('Error publishing item:', err);
      toast.error("Failed to publish item");
    }
  };

  const handleGenerateMagazineContent = async () => {
    if (!aiPrompt) {
      toast.warning("Please enter a prompt for the AI assistant");
      return;
    }
    
    toast.info("Generating magazine content...", { duration: 2000 });
    
    try {
      // Call the Supabase edge function to generate content
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: aiPrompt,
          model: 'gpt-4o-mini',
          input_data: {
            cluster: selectedCluster ? 
              keywordClusters?.find(c => c.id === selectedCluster)?.primary_theme : 
              'General'
          },
          include_clusters: true,
          include_tracking_summary: true
        }
      });
      
      if (error) throw error;
      
      // Create a new editor brief with the generated content
      const { error: insertError } = await supabase
        .from('editor_briefs')
        .insert({
          theme: `AI-Generated: ${aiPrompt.slice(0, 50)}${aiPrompt.length > 50 ? '...' : ''}`,
          summary: typeof data.output === 'string' ? 
            data.output.slice(0, 200) : 
            JSON.stringify(data.output).slice(0, 200),
          outline: typeof data.output === 'string' ? 
            data.output : 
            JSON.stringify(data.output),
          status: 'draft',
          sources: [],
          suggested_articles: []
        });
        
      if (insertError) throw insertError;
      
      toast.success("Content generated and saved as an editor brief");
      setAiPrompt("");
      refetchBriefs();
      setShowAiAssistant(false);
    } catch (err) {
      console.error('Error generating content:', err);
      toast.error("Failed to generate content");
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

  // Generate 24 months for the calendar view
  const getMonthsForCalendar = () => {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const monthStr = date.toISOString().substring(0, 7); // YYYY-MM format
      const monthName = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      months.push({ value: monthStr, label: `${monthName} ${year}` });
    }
    
    return months;
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
          <div className="flex gap-2">
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
            
            <Button 
              variant="outline" 
              className="ml-2 flex items-center gap-2"
              onClick={() => setShowAiAssistant(true)}
            >
              <Lightbulb className="h-4 w-4" />
              AI Assistant
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={viewMode}>
        <TabsContent value="kanban" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-3 px-2">Planning</h2>
              <div className="space-y-3">
                {planningStageItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow h-[280px] flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          Planning
                        </Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">{item.headline}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow justify-between pt-0">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                          {item.summary 
                            ? item.summary
                            : 'No summary available'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Source: {item.source} | Date: {new Date(item.timestamp || '').toLocaleDateString()}
                        </p>
                      </div>
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
                {editorBriefs?.filter(brief => brief.status === 'draft').map((brief) => (
                  <Card key={brief.id} className="overflow-hidden hover:shadow-md transition-shadow h-[280px] flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                          Brief
                        </Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">{brief.theme}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow justify-between pt-0">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                          {brief.summary || 'No summary available'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(brief.created_at || '').toLocaleDateString()}
                        </p>
                      </div>
                      <div className="mt-4 flex justify-end space-x-2">
                        <Button variant="outline" size="sm">
                          View Brief
                        </Button>
                        <Button variant="default" size="sm">
                          Develop Article
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {planningStageItems.length === 0 && editorBriefs?.filter(brief => brief.status === 'draft').length === 0 && (
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
                  <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow h-[280px] flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                          Draft Ready
                        </Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">{item.headline}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow justify-between pt-0">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                          {item.summary 
                            ? item.summary
                            : 'No summary available'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Source: {item.source} | Date: {new Date(item.timestamp || '').toLocaleDateString()}
                        </p>
                      </div>
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
                  <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow h-[280px] flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          Published
                        </Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">{item.headline}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow justify-between pt-0">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                          {item.summary 
                            ? item.summary
                            : 'No summary available'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Source: {item.source} | Date: {new Date(item.timestamp || '').toLocaleDateString()}
                        </p>
                      </div>
                      <div className="mt-4 flex justify-end space-x-2">
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
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle>Publication Calendar</CardTitle>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {getMonthsForCalendar().map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <CardDescription>
                Plan and schedule magazine articles up to 24 months in advance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <CardHeader className="p-4">
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 mb-2">Feature Article</Badge>
                    <CardTitle className="text-base">Drop Feature Here</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <CardHeader className="p-4">
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 mb-2">Industry Analysis</Badge>
                    <CardTitle className="text-base">Drop Analysis Here</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <CardHeader className="p-4">
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 mb-2">Market Trends</Badge>
                    <CardTitle className="text-base">Drop Trends Here</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <CardHeader className="p-4">
                    <Badge className="bg-green-100 text-green-800 border-green-200 mb-2">Opinion Piece</Badge>
                    <CardTitle className="text-base">Drop Opinion Here</CardTitle>
                  </CardHeader>
                </Card>
              </div>
              
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Theme Coverage Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Keyword Clusters</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clustersLoading ? (
                        <p className="text-sm text-muted-foreground">Loading clusters...</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {keywordClusters?.slice(0, 10).map((cluster) => (
                            <Badge 
                              key={cluster.id} 
                              variant="outline" 
                              className="py-1 px-2"
                            >
                              {cluster.primary_theme}
                            </Badge>
                          ))}
                          {keywordClusters && keywordClusters.length > 10 && (
                            <Badge variant="outline" className="py-1 px-2">
                              +{keywordClusters.length - 10} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">AI Content Suggestions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => setShowAiAssistant(true)}
                        className="w-full"
                      >
                        <Lightbulb className="h-4 w-4 mr-2" />
                        Generate Content Ideas
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t">
              <div className="flex items-center justify-between w-full">
                <p className="text-sm text-muted-foreground">
                  Planning for {selectedMonth ? new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : ''}
                </p>
                <Button variant="outline" size="sm">
                  <PenLine className="h-4 w-4 mr-2" />
                  Edit Theme
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* AI Assistant Dialog */}
      <Dialog open={showAiAssistant} onOpenChange={setShowAiAssistant}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>AI Content Assistant</DialogTitle>
            <DialogDescription>
              Generate article ideas, research topics, or create content outlines using AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="keyword-cluster" className="text-sm font-medium mb-2 block">
                Select Keyword Cluster for Context (Optional)
              </label>
              <Select value={selectedCluster} onValueChange={setSelectedCluster}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a keyword cluster" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Clusters</SelectItem>
                  {keywordClusters?.map((cluster) => (
                    <SelectItem key={cluster.id} value={cluster.id}>
                      {cluster.primary_theme}: {cluster.sub_theme}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label htmlFor="ai-prompt" className="text-sm font-medium mb-2 block">
                What would you like the AI to help with?
              </label>
              <textarea 
                id="ai-prompt" 
                className="min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                placeholder="e.g., 'Generate an article outline about the impact of rising interest rates on mortgage refinancing'"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </div>
            
            <Separator />
            
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setShowAiAssistant(false)}>
                Cancel
              </Button>
              <Button 
                variant="default" 
                onClick={handleGenerateMagazineContent}
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

export default MagazinePlanner;
