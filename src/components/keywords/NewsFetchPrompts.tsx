
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, Search, Code, Settings2, Play, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationBadge } from "@/components/ui/notification-badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NewsFetchPromptForm from "./NewsFetchPromptForm";

export default function NewsFetchPrompts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<LlmPrompt | null>(null);
  const [promptToTest, setPromptToTest] = useState<LlmPrompt | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const { data: prompts, isLoading, refetch } = useQuery({
    queryKey: ["llm-prompts", "news-search"],
    queryFn: async () => {
      // Find prompts with news search metadata
      const { data, error } = await supabase
        .from("llm_prompts")
        .select("*")
        .order("function_name");

      if (error) throw error;

      // Filter for news search prompts
      return (data || []).filter(prompt => {
        // Check if the prompt has the news search metadata
        const metadataMatch = prompt.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
        if (metadataMatch) {
          try {
            const metadata = JSON.parse(metadataMatch[1]);
            return metadata.search_settings?.is_news_search === true;
          } catch (e) {
            return false;
          }
        }
        // Also include prompts that have "news" or "search" in their function name
        return prompt.function_name.toLowerCase().includes('news') || 
               prompt.function_name.toLowerCase().includes('search');
      });
    },
  });

  const runTestSearch = async () => {
    if (!promptToTest || !testQuery.trim()) return;
    
    setTesting(true);
    setTestResults(null);
    
    try {
      // Extract metadata from prompt
      let metadata: any = {};
      const metadataMatch = promptToTest.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
      if (metadataMatch) {
        try {
          metadata = JSON.parse(metadataMatch[1]);
        } catch (e) {
          console.error("Error parsing metadata:", e);
        }
      }
      
      // Clean the prompt text to remove metadata
      const cleanPromptText = promptToTest.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '');
      
      // Replace placeholders
      const finalPrompt = cleanPromptText.replace('[QUERY]', testQuery);
      
      // Call the edge function or API directly
      const searchSettings = metadata.search_settings || {};
      const response = await supabase.functions.invoke('fetch-perplexity-news', {
        body: {
          customPrompt: finalPrompt,
          model: promptToTest.model,
          keywords: [testQuery],
          minScore: 1.0,
          limit: 5,
          skipDuplicateCheck: true,
          temperature: searchSettings.temperature || 0.2,
          search_domain_filter: searchSettings.domain_filter || 'auto',
          search_recency_filter: searchSettings.recency_filter || 'day',
          max_tokens: searchSettings.max_tokens || 1000
        }
      });
      
      setTestResults(response.data || { error: 'No results returned' });
      toast.success('Test search completed');
    } catch (error) {
      console.error('Search test error:', error);
      setTestResults({ error: error instanceof Error ? error.message : 'Unknown error' });
      toast.error('Error running test search');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setShowAddPrompt(false);
    setEditingPrompt(null);
    refetch();
  };

  const filteredPrompts = prompts?.filter(prompt =>
    prompt.function_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const modelColorMap: Record<string, string> = {
    'llama-3.1-sonar-small-128k-online': 'bg-blue-100 text-blue-800',
    'llama-3.1-sonar-large-128k-online': 'bg-indigo-100 text-indigo-800',
    'gpt-4o': 'bg-emerald-100 text-emerald-800',
    'gpt-4o-mini': 'bg-teal-100 text-teal-800',
    'default': 'bg-gray-100 text-gray-800'
  };

  const getModelBadgeClass = (model: string) => {
    return modelColorMap[model] || modelColorMap.default;
  };

  // Extract metadata from prompt text
  const extractMetadata = (promptText: string) => {
    const metadataMatch = promptText.match(/\/\*\n([\s\S]*?)\n\*\//);
    if (metadataMatch) {
      try {
        return JSON.parse(metadataMatch[1]);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setShowAddPrompt(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add News Search Prompt
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="opacity-70">
              <CardHeader className="animate-pulse bg-muted h-24" />
              <CardContent className="animate-pulse bg-muted h-32" />
              <CardFooter className="animate-pulse bg-muted h-12" />
            </Card>
          ))}
        </div>
      ) : filteredPrompts.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle>No News Search Prompts</CardTitle>
            <CardDescription>
              Create your first specialized news search prompt to enhance the quality of fetched news.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => setShowAddPrompt(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create News Search Prompt
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPrompts.map((prompt) => {
            const metadata = extractMetadata(prompt.prompt_text);
            const searchSettings = metadata?.search_settings || {};
            
            return (
              <Card key={prompt.id} className={!prompt.is_active ? "opacity-60" : undefined}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {prompt.function_name}
                        {!prompt.is_active && (
                          <Badge variant="outline" className="ml-2">
                            Inactive
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <Badge className={getModelBadgeClass(prompt.model)}>
                          {prompt.model}
                        </Badge>
                        
                        {searchSettings.recency_filter && (
                          <Badge variant="outline" className="ml-2">
                            {searchSettings.recency_filter === '30m' ? '30 minutes' :
                             searchSettings.recency_filter === 'hour' ? 'Hour' :
                             searchSettings.recency_filter === 'day' ? 'Day' :
                             searchSettings.recency_filter === 'week' ? 'Week' :
                             searchSettings.recency_filter === 'month' ? 'Month' : 'Year'}
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditingPrompt(prompt)}
                      >
                        <Settings2 className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setPromptToTest(prompt)}
                      >
                        <Play className="h-4 w-4" />
                        <span className="sr-only">Test</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {prompt.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '')}
                    </pre>
                  </ScrollArea>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    {prompt.include_clusters && (
                      <Badge variant="secondary">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Clusters
                      </Badge>
                    )}
                    {prompt.include_tracking_summary && (
                      <Badge variant="secondary">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Tracking
                      </Badge>
                    )}
                    {prompt.include_sources_map && (
                      <Badge variant="secondary">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Sources
                      </Badge>
                    )}
                    {searchSettings.domain_filter && searchSettings.domain_filter !== 'auto' && (
                      <Badge variant="outline">
                        Domain: {searchSettings.domain_filter}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={showAddPrompt || editingPrompt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddPrompt(false);
            setEditingPrompt(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <NewsFetchPromptForm 
            initialData={editingPrompt} 
            onSave={handleSave}
            onCancel={() => {
              setShowAddPrompt(false);
              setEditingPrompt(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog 
        open={promptToTest !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPromptToTest(null);
            setTestQuery("");
            setTestResults(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Search Prompt</DialogTitle>
            <DialogDescription>
              Test your prompt with a query before using it in the scheduled news fetch.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-4 gap-4 items-end">
              <div className="col-span-3">
                <label htmlFor="test-query" className="text-sm font-medium">
                  Search Query
                </label>
                <Input
                  id="test-query"
                  placeholder="Enter a search query e.g., mortgage rates forecast"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                />
              </div>
              <Button 
                onClick={runTestSearch} 
                disabled={testing || !testQuery.trim()}
                className="col-span-1"
              >
                {testing ? "Searching..." : "Search"}
              </Button>
            </div>
            
            {testResults && (
              <div className="space-y-3">
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2">Search Results</h3>
                  
                  {testResults.error ? (
                    <div className="p-4 bg-red-50 text-red-700 rounded-md">
                      <XCircle className="h-5 w-5 inline mr-2" />
                      Error: {testResults.error}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">
                          {testResults.results?.total || 0} results found
                        </Badge>
                        <Badge variant="secondary">
                          {testResults.results?.inserted || 0} new items
                        </Badge>
                      </div>
                      
                      <Tabs defaultValue="results">
                        <TabsList className="w-full">
                          <TabsTrigger value="results">Results</TabsTrigger>
                          <TabsTrigger value="raw">Raw Response</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="results" className="space-y-4 mt-2">
                          {testResults.results?.inserted === 0 ? (
                            <div className="p-4 bg-amber-50 text-amber-700 rounded-md">
                              <p>No new items found that match your criteria.</p>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-muted-foreground">
                                Found {testResults.results?.inserted || 0} new items.
                                {testResults.results?.skipped?.duplicates > 0 && ` Skipped ${testResults.results.skipped.duplicates} duplicates.`}
                                {testResults.results?.skipped?.lowScore > 0 && ` Skipped ${testResults.results.skipped.lowScore} low-scoring items.`}
                              </p>
                              
                              <Button variant="outline" size="sm" onClick={() => refetch()}>
                                Refresh Prompt List
                              </Button>
                            </>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="raw" className="mt-2">
                          <ScrollArea className="h-60 w-full rounded border">
                            <pre className="p-4 text-xs">{JSON.stringify(testResults, null, 2)}</pre>
                          </ScrollArea>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptToTest(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
