import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deletePrompt } from "@/utils/llmPromptsUtils";
import { toast } from "sonner";

interface PromptsListProps {
  prompts: LlmPrompt[];
  isLoading: boolean;
  onEdit: (prompt: LlmPrompt) => void;
  onRefresh: () => void;
  showSearchBadge?: boolean;
}

export default function PromptsList({ 
  prompts, 
  isLoading, 
  onEdit, 
  onRefresh, 
  showSearchBadge = false 
}: PromptsListProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  
  const deleteMutation = useMutation({
    mutationFn: deletePrompt,
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-prompts'] });
      toast.success("Prompt deleted successfully");
    },
    onError: (error: any) => {
      console.error("Error deleting prompt:", error);
      toast.error(`Failed to delete prompt: ${error.message || "Unknown error"}`);
    },
    onSettled: () => {
      setIsDeleting(false);
      onRefresh();
    }
  });
  
  const handleDelete = async (promptId: string) => {
    if (window.confirm("Are you sure you want to delete this prompt?")) {
      await deleteMutation.mutateAsync(promptId);
    }
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading prompts...
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No prompts found. Add a new prompt to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {prompts.map((prompt) => (
            <Card key={prompt.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{prompt.function_name}</CardTitle>
                      <Badge variant={prompt.is_active ? "default" : "secondary"}>
                        {prompt.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {showSearchBadge && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          Search
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Model: {prompt.model}</span>
                      <span>Updated: {new Date(prompt.updated_at).toLocaleDateString()}</span>
                      {prompt.last_updated_by && (
                        <span>By: {prompt.last_updated_by}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(prompt)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(prompt.id)} disabled={isDeleting}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground line-clamp-3">
                  {prompt.prompt_text}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
