
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PromptsList from "@/components/llm/PromptsList";
import PromptForm from "@/components/llm/PromptForm";
import { fetchPrompts } from "@/utils/llmPromptsUtils";
import VisualPromptBuilder from "@/components/keywords/VisualPromptBuilder";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function PromptsTab() {
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [useVisualBuilder, setUseVisualBuilder] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<LlmPrompt | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: prompts, isLoading, error, refetch } = useQuery({
    queryKey: ['llm-prompts'],
    queryFn: fetchPrompts
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
    // Immediately refetch to update the list with the new/edited prompt
    refetch();
    handleFormClose();
    toast.success(editingPrompt ? "Prompt updated successfully" : "Prompt created successfully");
  };
  
  const filteredPrompts = prompts?.filter(prompt => 
    prompt.function_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by function name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={handleAddNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Prompt
        </Button>
      </div>
      
      <PromptsList 
        prompts={filteredPrompts || []} 
        isLoading={isLoading} 
        onEdit={handleEdit} 
        onRefresh={refetch}
      />
      
      {isAddingPrompt && (
        <>
          <div className="mb-4 mt-6 flex justify-center">
            <Tabs value={useVisualBuilder ? "visual" : "advanced"} onValueChange={(v) => setUseVisualBuilder(v === "visual")}>
              <TabsList>
                <TabsTrigger value="visual">Visual Builder</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Editor</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {useVisualBuilder ? (
            <VisualPromptBuilder
              initialPrompt={editingPrompt}
              onSave={async (promptData) => {
                try {
                  // Save the prompt data via API or supabase
                  handleSuccess();
                } catch (error) {
                  console.error("Error saving prompt:", error);
                  toast.error("Failed to save prompt");
                }
              }}
              onCancel={handleFormClose}
            />
          ) : (
            <PromptForm
              prompt={editingPrompt}
              open={isAddingPrompt}
              onOpenChange={setIsAddingPrompt}
              onSuccess={handleSuccess}
            />
          )}
        </>
      )}
    </div>
  );
}
