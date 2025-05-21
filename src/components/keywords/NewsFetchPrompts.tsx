
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, PlusCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import VisualPromptBuilder from "./VisualPromptBuilder";
import NewsFetchPromptForm from "./NewsFetchPromptForm";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { filterNewsSearchPrompts, extractPromptMetadata } from "@/utils/llmPromptsUtils";

export default function NewsFetchPrompts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [useVisualBuilder, setUseVisualBuilder] = useState(true); // Default to visual builder
  const [selectedPrompt, setSelectedPrompt] = useState<LlmPrompt | null>(null);
  
  const { data: prompts, isLoading, error, refetch } = useQuery({
    queryKey: ['news-search-prompts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('llm_prompts')
        .select('*')
        .eq('is_active', true)
        .order('function_name');
        
      if (error) throw error;
      return filterNewsSearchPrompts(data || []);
    }
  });
  
  const filteredPrompts = prompts?.filter(p => 
    p.function_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSuccess = () => {
    refetch();
    setShowAddForm(false);
    setSelectedPrompt(null);
    toast.success(selectedPrompt ? "Prompt updated successfully" : "Prompt created successfully");
  };

  const handleEditPrompt = (prompt: LlmPrompt) => {
    setSelectedPrompt(prompt);
    setShowAddForm(true);
  };

  return (
    <div className="space-y-6">
      {showAddForm ? (
        <>
          <div className="mb-4 flex justify-center">
            <Tabs value={useVisualBuilder ? "visual" : "advanced"} onValueChange={(v) => setUseVisualBuilder(v === "visual")}>
              <TabsList>
                <TabsTrigger value="visual">Visual Builder</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Editor</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {useVisualBuilder ? (
            <VisualPromptBuilder
              initialPrompt={selectedPrompt}
              onSave={handleSuccess}
              onCancel={() => { setShowAddForm(false); setSelectedPrompt(null); }}
              initialActiveTab="search" // Start on search tab for news fetch prompts
            />
          ) : (
            <NewsFetchPromptForm
              initialData={selectedPrompt}
              onSave={() => { refetch(); setShowAddForm(false); setSelectedPrompt(null); }}
              onCancel={() => { setShowAddForm(false); setSelectedPrompt(null); }}
            />
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setShowAddForm(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create News Search Prompt
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                    <div className="flex gap-2 mt-4">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : error ? (
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle className="text-center text-red-500">Error loading prompts</CardTitle>
                  <CardDescription className="text-center">
                    Failed to load news search prompts. Please try refreshing the page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                  <Button onClick={() => refetch()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : filteredPrompts.length === 0 ? (
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle className="text-center">No news search prompts found</CardTitle>
                  <CardDescription className="text-center">
                    {searchTerm ? 
                      "Try adjusting your search term" : 
                      "Create your first news search prompt to get started"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                  <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create News Search Prompt
                  </Button>
                </CardContent>
              </Card>
            ) : filteredPrompts.map((prompt) => {
              const metadata = extractPromptMetadata(prompt);
              const settings = metadata?.search_settings || {};
              
              return (
                <Card key={prompt.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold truncate">
                      {prompt.function_name}
                    </CardTitle>
                    <CardDescription>
                      {prompt.model.includes('llama') || prompt.model.includes('sonar') 
                        ? 'Llama 3.1 Sonar with online search'
                        : prompt.model.includes('gpt-4') 
                          ? 'GPT-4 (Powerful)' 
                          : prompt.model.includes('gpt-3.5')
                            ? 'GPT-3.5 (Fast)'
                            : prompt.model.includes('claude')
                              ? 'Claude (High quality)'
                              : prompt.model}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-24 overflow-hidden text-sm text-muted-foreground mb-4">
                      {prompt.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '')}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {settings.recency_filter && (
                        <Badge variant="outline">
                          {settings.recency_filter === 'day' ? '24h' : settings.recency_filter}
                        </Badge>
                      )}
                      
                      {settings.domain_filter && settings.domain_filter !== 'auto' && (
                        <Badge variant="outline">
                          {settings.domain_filter}
                        </Badge>
                      )}
                      
                      {settings.selected_themes?.primary?.length > 0 && (
                        <Badge variant="secondary">
                          {settings.selected_themes.primary.length} themes
                        </Badge>
                      )}
                      
                      {prompt.include_clusters && (
                        <Badge variant="secondary">Uses clusters</Badge>
                      )}
                      
                      {prompt.include_tracking_summary && (
                        <Badge variant="secondary">Uses tracking</Badge>
                      )}
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditPrompt(prompt)}
                      >
                        Edit Prompt
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
