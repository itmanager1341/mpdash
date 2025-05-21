import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { createPrompt, updatePrompt, extractPromptMetadata } from "@/utils/llmPromptsUtils";
import { toast } from "sonner";

const promptSchema = z.object({
  function_name: z.string().min(1, "Function name is required"),
  model: z.string().min(1, "Model is required"),
  prompt_text: z.string().min(10, "Prompt text should be at least 10 characters"),
  include_clusters: z.boolean().default(false),
  include_tracking_summary: z.boolean().default(false),
  include_sources_map: z.boolean().default(false),
  is_active: z.boolean().default(true),
  search_settings: z.object({
    domain_filter: z.string().default("auto"),
    recency_filter: z.string().default("week"),
    temperature: z.number().min(0).max(1).default(0.7),
    max_tokens: z.number().min(100).max(4000).default(1500),
    is_news_search: z.boolean().default(true),
  }).optional(),
  selected_themes: z.object({
    primary: z.array(z.string()).default([]),
    sub: z.array(z.string()).default([]),
    professions: z.array(z.string()).default([]),
  }).optional(),
});

type PromptFormValues = z.infer<typeof promptSchema>;

interface VisualPromptBuilderProps {
  initialPrompt: LlmPrompt | null;
  onSave: (promptData: any) => void;
  onCancel: () => void;
}

export default function VisualPromptBuilder({ initialPrompt, onSave, onCancel }: VisualPromptBuilderProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Extract metadata from the initial prompt if it exists
  const metadata = initialPrompt ? extractPromptMetadata(initialPrompt) : null;
  
  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      function_name: initialPrompt?.function_name || "",
      model: initialPrompt?.model || "gpt-4o",
      prompt_text: initialPrompt?.prompt_text || "",
      include_clusters: initialPrompt?.include_clusters || false,
      include_tracking_summary: initialPrompt?.include_tracking_summary || false,
      include_sources_map: initialPrompt?.include_sources_map || false,
      is_active: initialPrompt?.is_active ?? true,
      search_settings: {
        domain_filter: metadata?.search_settings?.domain_filter || "auto",
        recency_filter: metadata?.search_settings?.recency_filter || "week",
        temperature: metadata?.search_settings?.temperature || 0.7,
        max_tokens: metadata?.search_settings?.max_tokens || 1500,
        is_news_search: true,
      },
      selected_themes: {
        primary: metadata?.search_settings?.selected_themes?.primary || [],
        sub: metadata?.search_settings?.selected_themes?.sub || [],
        professions: metadata?.search_settings?.selected_themes?.professions || [],
      },
    },
  });
  
  const handleSubmit = async (data: PromptFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Create metadata JSON to embed in the prompt text
      const metadata = {
        search_settings: {
          domain_filter: data.search_settings?.domain_filter || "auto",
          recency_filter: data.search_settings?.recency_filter || "week",
          temperature: data.search_settings?.temperature || 0.7,
          max_tokens: data.search_settings?.max_tokens || 1500,
          is_news_search: true,
          selected_themes: data.selected_themes || {
            primary: [],
            sub: [],
            professions: []
          }
        }
      };
      
      // Add metadata as a comment at the top of the prompt text
      const metadataComment = `/*\n${JSON.stringify(metadata, null, 2)}\n*/\n`;
      const promptTextWithMetadata = data.prompt_text.startsWith("/*") 
        ? data.prompt_text 
        : metadataComment + data.prompt_text;
      
      const promptData = {
        function_name: data.function_name,
        model: data.model,
        prompt_text: promptTextWithMetadata,
        include_clusters: data.include_clusters,
        include_tracking_summary: data.include_tracking_summary,
        include_sources_map: data.include_sources_map,
        is_active: data.is_active,
      };
      
      if (initialPrompt?.id) {
        await updatePrompt(initialPrompt.id, promptData);
      } else {
        await createPrompt(promptData);
      }
      
      onSave(promptData);
    } catch (error: any) {
      console.error("Error saving prompt:", error);
      toast.error(`Failed to save prompt: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{initialPrompt ? "Edit Prompt" : "Create New Prompt"}</CardTitle>
          <CardDescription>
            Build a prompt template for news search and content generation
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="search">Search Parameters</TabsTrigger>
                <TabsTrigger value="template">Prompt Template</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="function_name">Function Name</Label>
                    <Input
                      id="function_name"
                      placeholder="e.g., news_search_mortgage_rates"
                      {...form.register("function_name")}
                    />
                    {form.formState.errors.function_name && (
                      <p className="text-sm text-red-500">{form.formState.errors.function_name.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Select 
                      onValueChange={(value) => form.setValue("model", value)}
                      defaultValue={form.getValues("model")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o (Best for complex analysis)</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 (Faster, good for simple tasks)</SelectItem>
                        <SelectItem value="claude-3-opus">Claude 3 Opus (High quality, slower)</SelectItem>
                        <SelectItem value="claude-3-sonnet">Claude 3 Sonnet (Balanced)</SelectItem>
                        <SelectItem value="perplexity">Perplexity (Best for real-time news)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Context Options</h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="include_clusters">Include Keyword Clusters</Label>
                        <p className="text-sm text-muted-foreground">
                          Add keyword cluster data to the prompt context
                        </p>
                      </div>
                      <Switch
                        id="include_clusters"
                        checked={form.watch("include_clusters")}
                        onCheckedChange={(checked) => form.setValue("include_clusters", checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="include_tracking_summary">Include Tracking Summary</Label>
                        <p className="text-sm text-muted-foreground">
                          Add keyword tracking summary data to the prompt context
                        </p>
                      </div>
                      <Switch
                        id="include_tracking_summary"
                        checked={form.watch("include_tracking_summary")}
                        onCheckedChange={(checked) => form.setValue("include_tracking_summary", checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="include_sources_map">Include Source Map</Label>
                        <p className="text-sm text-muted-foreground">
                          Add source tier mappings to the prompt context
                        </p>
                      </div>
                      <Switch
                        id="include_sources_map"
                        checked={form.watch("include_sources_map")}
                        onCheckedChange={(checked) => form.setValue("include_sources_map", checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="is_active">Active</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable or disable this prompt
                        </p>
                      </div>
                      <Switch
                        id="is_active"
                        checked={form.watch("is_active")}
                        onCheckedChange={(checked) => form.setValue("is_active", checked)}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="search" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain_filter">Domain Filter</Label>
                    <Select 
                      onValueChange={(value) => form.setValue("search_settings.domain_filter", value)}
                      defaultValue={form.getValues("search_settings.domain_filter")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select domain filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (Based on query)</SelectItem>
                        <SelectItem value="news">News Sites Only</SelectItem>
                        <SelectItem value="blogs">Blogs & Opinion</SelectItem>
                        <SelectItem value="research">Research & Reports</SelectItem>
                        <SelectItem value="government">Government Sources</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="recency_filter">Recency Filter</Label>
                    <Select 
                      onValueChange={(value) => form.setValue("search_settings.recency_filter", value)}
                      defaultValue={form.getValues("search_settings.recency_filter")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select recency filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Last 24 Hours</SelectItem>
                        <SelectItem value="week">Last Week</SelectItem>
                        <SelectItem value="month">Last Month</SelectItem>
                        <SelectItem value="year">Last Year</SelectItem>
                        <SelectItem value="any">Any Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={form.watch("search_settings.temperature")}
                        onChange={(e) => form.setValue("search_settings.temperature", parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <span className="text-sm font-mono w-10">
                        {form.watch("search_settings.temperature")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lower values are more focused, higher values more creative
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="max_tokens">Max Tokens</Label>
                    <Input
                      id="max_tokens"
                      type="number"
                      min="100"
                      max="4000"
                      {...form.register("search_settings.max_tokens", { valueAsNumber: true })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum length of the generated response
                    </p>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Theme Selection</h3>
                  <p className="text-sm text-muted-foreground">
                    This feature will be available in a future update
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Mortgage Rates</Badge>
                    <Badge variant="outline">Housing Market</Badge>
                    <Badge variant="outline">Federal Reserve</Badge>
                    <Badge variant="outline">Refinancing</Badge>
                    <Badge variant="outline">+ Add Theme</Badge>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="template" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt_text">Prompt Template</Label>
                  <Textarea
                    id="prompt_text"
                    placeholder="Enter your prompt template..."
                    className="min-h-[300px] font-mono text-sm"
                    {...form.register("prompt_text")}
                  />
                  {form.formState.errors.prompt_text && (
                    <p className="text-sm text-red-500">{form.formState.errors.prompt_text.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    You can use variables like {"{search_query}"} which will be replaced with actual data
                  </p>
                </div>
                
                <div className="bg-muted p-4 rounded-md">
                  <h4 className="text-sm font-medium mb-2">Available Variables</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Badge variant="secondary" className="justify-start">{"{search_query}"}</Badge>
                    <Badge variant="secondary" className="justify-start">{"{date_range}"}</Badge>
                    <Badge variant="secondary" className="justify-start">{"{clusters_data}"}</Badge>
                    <Badge variant="secondary" className="justify-start">{"{tracking_summary}"}</Badge>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : (initialPrompt ? "Update Prompt" : "Create Prompt")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
