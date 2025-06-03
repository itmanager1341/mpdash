
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Search, Calendar, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PromptsList from "@/components/llm/PromptsList";
import VisualPromptBuilder from "@/components/keywords/VisualPromptBuilder";
import { fetchPrompts } from "@/utils/llmPromptsUtils";
import { toast } from "sonner";

interface SearchPromptsTabProps {
  searchTerm: string;
}

export default function SearchPromptsTab({ searchTerm }: SearchPromptsTabProps) {
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<LlmPrompt | null>(null);
  const [promptSearchTerm, setPromptSearchTerm] = useState("");
  
  const { data: prompts, isLoading, error, refetch } = useQuery({
    queryKey: ['news-search-prompts'],
    queryFn: async () => {
      const allPrompts = await fetchPrompts();
      // Filter to only news search prompts (those that include search settings metadata)
      return allPrompts.filter(prompt => 
        prompt.prompt_text.includes('search_settings') || 
        prompt.function_name.includes('news') ||
        prompt.function_name.includes('search')
      );
    }
  });

  const handleAddNew = () => {
    setEditingPrompt(null);
    setIsAddingPrompt(true);
  };
  
  const handleEdit = (prompt: LlmPrompt) => {
    setEditingPrompt(prompt);
    setIsAddingPrompt(true);
  };
  
  const handleFormClose = () => {
    setIsAddingPrompt(false);
    setEditingPrompt(null);
  };
  
  const handleSuccess = () => {
    refetch();
    handleFormClose();
    toast.success(editingPrompt ? "Search prompt updated successfully" : "Search prompt created successfully");
  };
  
  const filteredPrompts = prompts?.filter(prompt => 
    prompt.function_name.toLowerCase().includes(promptSearchTerm.toLowerCase()) ||
    prompt.function_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    console.error("Error fetching search prompts:", error);
    toast.error("Failed to load search prompts. Please try refreshing the page.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">News Search Prompts</h2>
            <p className="text-muted-foreground">
              Create and manage AI prompts for automated news discovery and on-demand content research
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Search Prompt
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Prompts</p>
                  <p className="text-2xl font-bold">
                    {prompts?.filter(p => p.is_active).length || 0}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-800">Live</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold">2</p>
                </div>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">On-Demand</p>
                  <p className="text-2xl font-bold">
                    {prompts?.length ? prompts.length - 2 : 0}
                  </p>
                </div>
                <Play className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search search prompts..."
            value={promptSearchTerm}
            onChange={(e) => setPromptSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      
      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">About Search Prompts</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Search prompts are specialized AI templates that use real-time search capabilities to discover and analyze news content. 
            They can be scheduled to run automatically for regular news monitoring, or executed on-demand for specific research needs.
          </p>
          <div className="mt-3 flex gap-2">
            <Badge variant="outline" className="text-xs">Perplexity Models Recommended</Badge>
            <Badge variant="outline" className="text-xs">Real-time Search</Badge>
            <Badge variant="outline" className="text-xs">Cluster-Weighted</Badge>
          </div>
        </CardContent>
      </Card>
      
      <PromptsList 
        prompts={filteredPrompts || []} 
        isLoading={isLoading} 
        onEdit={handleEdit} 
        onRefresh={refetch}
        showSearchBadge={true}
      />
      
      {isAddingPrompt && (
        <VisualPromptBuilder
          initialPrompt={editingPrompt}
          onSave={handleSuccess}
          onCancel={handleFormClose}
        />
      )}
    </div>
  );
}
