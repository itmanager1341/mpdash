
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
      
      // Filter to get only news search prompts by checking metadata if possible
      return (data || []).filter(prompt => {
        // Check if prompt has news search metadata
        const metadataMatch = prompt.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
        if (metadataMatch) {
          try {
            const metadata = JSON.parse(metadataMatch[1]);
            return metadata.search_settings?.is_news_search === true;
          } catch (e) {
            return false;
          }
        }
        // Also include prompts explicitly marked with news_search in name
        return prompt.function_name?.includes('news_search');
      });
    }
  });
  
  const filteredPrompts = prompts?.filter(p => 
    p.function_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSavePrompt = async (promptData: any) => {
    try {
      if (selectedPrompt?.id) {
        await supabase
          .from('llm_prompts')
          .update(promptData)
          .eq('id', selectedPrompt.id);
          
        toast.success("Prompt updated successfully");
      } else {
        await supabase
          .from('llm_prompts')
          .insert([promptData]);
          
        toast.success("Prompt created successfully");
      }
      
      refetch();
      setShowAddForm(false);
      setSelectedPrompt(null);
    } catch (error: any) {
      toast.error(`Error saving prompt: ${error.message}`);
    }
  };

  const handleEditPrompt = (prompt: LlmPrompt) => {
    setSelectedPrompt(prompt);
    setShowAddForm(true);
  };

  const extractMetadata = (prompt: LlmPrompt) => {
    const metadataMatch = prompt.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
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
      {showAddForm ? (
        <>
          {useVisualBuilder ? (
            <VisualPromptBuilder
              initialPrompt={selectedPrompt}
              onSave={handleSavePrompt}
              onCancel={() => { setShowAddForm(false); setSelectedPrompt(null); }}
            />
          ) : (
            <NewsFetchPromptForm
              initialData={selectedPrompt}
              onSave={() => { refetch(); setShowAddForm(false); setSelectedPrompt(null); }}
              onCancel={() => { setShowAddForm(false); setSelectedPrompt(null); }}
            />
          )}
          
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => setUseVisualBuilder(!useVisualBuilder)}
            >
              Switch to {useVisualBuilder ? "Advanced Editor" : "Visual Builder"}
            </Button>
          </div>
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
              const metadata = extractMetadata(prompt);
              const settings = metadata?.search_settings || {};
              
              return (
                <Card key={prompt.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold truncate">
                      {prompt.function_name}
                    </CardTitle>
                    <CardDescription>
                      Using {prompt.model.includes('llama') ? 'Llama' : prompt.model}
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
