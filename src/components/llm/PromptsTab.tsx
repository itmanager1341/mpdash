
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Search, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PromptsList from "@/components/llm/PromptsList";
import VisualPromptBuilder from "@/components/keywords/VisualPromptBuilder";
import { fetchPrompts } from "@/utils/llmPromptsUtils";
import { toast } from "sonner";

export default function PromptsTab() {
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<LlmPrompt | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: allPrompts, isLoading, error, refetch } = useQuery({
    queryKey: ['llm-prompts'],
    queryFn: fetchPrompts
  });

  // Filter OUT news search prompts - those belong in Keyword Management
  const prompts = allPrompts?.filter(prompt => {
    // Exclude prompts that are clearly for news search
    const isNewsSearchPrompt = 
      prompt.prompt_text.includes('search_settings') || 
      prompt.prompt_text.includes('domain_filter') ||
      prompt.prompt_text.includes('recency_filter') ||
      prompt.function_name.toLowerCase().includes('news') ||
      prompt.function_name.toLowerCase().includes('search') ||
      prompt.function_name.toLowerCase().includes('fetch');
    
    return !isNewsSearchPrompt;
  });

  const handleAddNew = () => {
    setEditingPrompt(null);
    setIsAddingPrompt(true);
  };
  
  const handleEdit = (prompt: LlmPrompt) => {
    console.log('Editing prompt:', prompt); // Debug log
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
    toast.success(editingPrompt ? "Prompt updated successfully" : "Prompt created successfully");
  };
  
  const filteredPrompts = prompts?.filter(prompt => 
    prompt.function_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    console.error("Error fetching prompts:", error);
    toast.error("Failed to load prompts. Please try refreshing the page.");
  }

  const getPromptCategoryStats = () => {
    if (!prompts) return { editorial: 0, analysis: 0, generation: 0, other: 0 };
    
    return prompts.reduce((acc, prompt) => {
      const fn = prompt.function_name.toLowerCase();
      if (fn.includes('edit') || fn.includes('review')) acc.editorial++;
      else if (fn.includes('analyz') || fn.includes('assess')) acc.analysis++;
      else if (fn.includes('generat') || fn.includes('creat') || fn.includes('writ')) acc.generation++;
      else acc.other++;
      return acc;
    }, { editorial: 0, analysis: 0, generation: 0, other: 0 });
  };

  const stats = getPromptCategoryStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">Editorial & Analysis Prompts</h2>
            <p className="text-muted-foreground">
              Manage AI prompts for content creation, editorial analysis, and general purpose tasks
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Prompt
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Editorial</p>
                  <p className="text-2xl font-bold">{stats.editorial}</p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">Edit</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Analysis</p>
                  <p className="text-2xl font-bold">{stats.analysis}</p>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700">Analyze</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Generation</p>
                  <p className="text-2xl font-bold">{stats.generation}</p>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700">Create</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Other</p>
                  <p className="text-2xl font-bold">{stats.other}</p>
                </div>
                <Badge variant="outline" className="bg-gray-50 text-gray-700">Misc</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Information Card */}
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base text-amber-800">Prompt Categories</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-amber-700 mb-3">
              This section manages editorial and analysis prompts. For news search prompts, visit the Keyword Management → Search Prompts tab.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Editorial Review</Badge>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Content Analysis</Badge>
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">Text Generation</Badge>
              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700">General Purpose</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by function name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>
      
      <PromptsList 
        prompts={filteredPrompts || []} 
        isLoading={isLoading} 
        onEdit={handleEdit} 
        onRefresh={refetch}
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
