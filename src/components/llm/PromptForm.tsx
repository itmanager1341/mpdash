
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { createPrompt, updatePrompt, extractPromptMetadata } from "@/utils/llmPromptsUtils";
import { useState } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const promptFormSchema = z.object({
  function_name: z.string().min(1, "Function name is required"),
  model: z.string().min(1, "Model is required"),
  prompt_text: z.string().min(10, "Prompt text should be at least 10 characters"),
  include_clusters: z.boolean(),
  include_tracking_summary: z.boolean(),
  include_sources_map: z.boolean(),
  is_active: z.boolean().default(true),
});

interface PromptFormProps {
  prompt: LlmPrompt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function PromptForm({ prompt, open, onOpenChange, onSuccess }: PromptFormProps) {
  const isEditing = !!prompt;
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof promptFormSchema>>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: {
      function_name: prompt?.function_name || "",
      model: prompt?.model || "gpt-4o",
      prompt_text: prompt?.prompt_text || "",
      include_clusters: prompt?.include_clusters || false,
      include_tracking_summary: prompt?.include_tracking_summary || false,
      include_sources_map: prompt?.include_sources_map || false,
      is_active: prompt?.is_active ?? true,
    },
  });

  const onSubmit = async (data: z.infer<typeof promptFormSchema>) => {
    try {
      setIsSubmitting(true);
      
      if (isEditing && prompt) {
        // Ensure we're passing all required fields for the update
        const updateData: LlmPromptFormData = {
          function_name: data.function_name,
          model: data.model,
          prompt_text: data.prompt_text,
          include_clusters: data.include_clusters,
          include_tracking_summary: data.include_tracking_summary,
          include_sources_map: data.include_sources_map,
          is_active: data.is_active,
        };
        
        await updatePrompt(prompt.id, updateData);
      } else {
        // Ensure we're passing all required fields for creation
        const createData: LlmPromptFormData = {
          function_name: data.function_name,
          model: data.model,
          prompt_text: data.prompt_text,
          include_clusters: data.include_clusters,
          include_tracking_summary: data.include_tracking_summary,
          include_sources_map: data.include_sources_map,
          is_active: data.is_active,
        };
        
        await createPrompt(createData);
      }
      
      onSuccess();
    } catch (error: any) {
      console.error("Error saving prompt:", error);
      toast.error(`Failed to save prompt: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modelOptions = [
    { value: "gpt-4o", label: "GPT-4o", description: "Best for complex analysis and reasoning" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5", description: "Faster, good for simpler tasks" },
    { value: "claude-3-opus", label: "Claude 3 Opus", description: "High quality, slower" },
    { value: "claude-3-sonnet", label: "Claude 3 Sonnet", description: "Balanced speed/quality" },
    { value: "llama-3.1-sonar-small-128k-online", label: "Llama 3.1 Sonar Small", description: "Fast with online search capability" },
    { value: "llama-3.1-sonar-large-128k-online", label: "Llama 3.1 Sonar Large", description: "More powerful with online search capability" },
    { value: "perplexity", label: "Perplexity", description: "Best for real-time news" },
  ];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isSubmitting) {
        onOpenChange(isOpen);
      }
    }}>
      <SheetContent className="w-full lg:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Prompt" : "Add New Prompt"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update the configuration and template for this prompt"
              : "Create a new prompt template for AI-assisted editorial functions"}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="function_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Function Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., generate_title" {...field} />
                    </FormControl>
                    <FormDescription>
                      Unique identifier for this prompt's function
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {modelOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select which language model to use for this prompt
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prompt_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt Template</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your prompt template..."
                        className="min-h-[200px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      You can use variables like {"{article_title}"} which will be replaced with actual data. 
                      For keyword clusters, use {"{clusters_data}"}.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Context Options</h3>
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="include_clusters"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Include Keyword Clusters</FormLabel>
                          <FormDescription>
                            Add keyword cluster data to the prompt context
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="include_tracking_summary"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Include Tracking Summary</FormLabel>
                          <FormDescription>
                            Add keyword tracking summary data to the prompt context
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="include_sources_map"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Include Source Map</FormLabel>
                          <FormDescription>
                            Add source tier mappings to the prompt context
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            Enable or disable this prompt
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <SheetFooter>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 
                    "Saving..." : 
                    (isEditing ? "Update Prompt" : "Create Prompt")
                  }
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
