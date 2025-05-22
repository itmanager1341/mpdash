
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PromptsList from "@/components/llm/PromptsList";
import VisualPromptBuilder from "@/components/keywords/VisualPromptBuilder";
import { fetchPrompts } from "@/utils/llmPromptsUtils";
import { toast } from "sonner";

export default function PromptsTab() {
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
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
        <VisualPromptBuilder
          initialPrompt={editingPrompt}
          onSave={handleSuccess}
          onCancel={handleFormClose}
          onSwitchToAdvanced={() => {}} // Empty function since we're removing advanced editor
        />
      )}
    </div>
  );
}
