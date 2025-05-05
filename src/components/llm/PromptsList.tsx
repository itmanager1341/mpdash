
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle, Edit, FlaskConical, Trash2, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { deletePrompt, togglePromptActive } from "@/utils/llmPromptsUtils";
import PromptTester from "@/components/llm/PromptTester";

interface PromptsListProps {
  prompts: LlmPrompt[];
  isLoading: boolean;
  onEdit: (prompt: LlmPrompt) => void;
  onRefresh: () => void;
}

export default function PromptsList({ prompts, isLoading, onEdit, onRefresh }: PromptsListProps) {
  const [promptToDelete, setPromptToDelete] = useState<LlmPrompt | null>(null);
  const [promptToTest, setPromptToTest] = useState<LlmPrompt | null>(null);

  const handleDelete = async () => {
    if (!promptToDelete) return;
    
    try {
      await deletePrompt(promptToDelete.id);
      toast.success("Prompt deleted successfully");
      onRefresh();
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast.error("Failed to delete prompt");
    } finally {
      setPromptToDelete(null);
    }
  };

  const handleToggleActive = async (prompt: LlmPrompt) => {
    try {
      await togglePromptActive(prompt.id, !prompt.is_active);
      toast.success(`Prompt ${prompt.is_active ? 'disabled' : 'activated'} successfully`);
      onRefresh();
    } catch (error) {
      console.error("Error toggling prompt:", error);
      toast.error("Failed to update prompt status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading prompts...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {prompts.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-md">
          <p className="text-muted-foreground">No prompts found</p>
          <p className="text-sm text-muted-foreground mt-1">Create a new prompt to get started</p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="hidden md:table-cell">Include Clusters</TableHead>
                <TableHead className="hidden md:table-cell">Tracking Summary</TableHead>
                <TableHead className="hidden md:table-cell">Source Map</TableHead>
                <TableHead className="hidden md:table-cell">Last Updated</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prompts.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell className="font-medium">{prompt.function_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{prompt.model}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {prompt.include_clusters ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {prompt.include_tracking_summary ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {prompt.include_sources_map ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span 
                      title={format(new Date(prompt.updated_at), 'PPpp')}
                      className="text-sm text-muted-foreground"
                    >
                      {formatDistanceToNow(new Date(prompt.updated_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={prompt.is_active}
                      onCheckedChange={() => handleToggleActive(prompt)}
                      aria-label={prompt.is_active ? "Active" : "Inactive"}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setPromptToTest(prompt)}
                        title="Test Prompt"
                      >
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onEdit(prompt)}
                        title="Edit Prompt"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setPromptToDelete(prompt)}
                        title="Delete Prompt"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!promptToDelete} onOpenChange={(open) => !open && setPromptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the prompt "{promptToDelete?.function_name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {promptToTest && (
        <PromptTester
          prompt={promptToTest}
          open={!!promptToTest}
          onOpenChange={(open) => !open && setPromptToTest(null)}
        />
      )}
    </>
  );
}
