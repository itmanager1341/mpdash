
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
import { createPrompt, updatePrompt } from "@/utils/llmPromptsUtils";

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
      if (isEditing && prompt) {
        await updatePrompt(prompt.id, data);
        toast.success("Prompt updated successfully");
      } else {
        await createPrompt(data);
        toast.success("Prompt created successfully");
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Failed to save prompt");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5</SelectItem>
                        <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                        <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                        <SelectItem value="perplexity">Perplexity</SelectItem>
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
                      You can use variables like {"{article_title}"} which will be replaced with actual data
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
                <Button type="submit">
                  {isEditing ? "Update Prompt" : "Create Prompt"}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
