import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Info, AlertCircle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import NewsSearchPromptTemplate from "./NewsSearchPromptTemplate";

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
  test_keyword: z.string().optional(),
});

type PromptFormValues = z.infer<typeof promptSchema>;

interface VisualPromptBuilderProps {
  initialPrompt: LlmPrompt | null;
  onSave: (promptData: any) => void;
  onCancel: () => void;
  initialActiveTab?: string;
  onSwitchToAdvanced?: () => void;
}

export default function VisualPromptBuilder({ 
  initialPrompt, 
  onSave, 
  onCancel,
  initialActiveTab = "basic",
  onSwitchToAdvanced
}: VisualPromptBuilderProps) {
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  
  // Extract metadata from the initial prompt if it exists
  const metadata = initialPrompt ? extractPromptMetadata(initialPrompt) : null;
  
  const { data: clusters, isLoading: isLoadingClusters } = useQuery({
    queryKey: ['keyword-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('id, primary_theme, sub_theme')
        .order('primary_theme');
        
      if (error) throw error;
      return data || [];
    }
  });
  
  // Parse selected themes from metadata if available
  const initialPrimaryThemes = metadata?.search_settings?.selected_themes?.primary || [];
  const initialSubThemes = metadata?.search_settings?.selected_themes?.sub || [];
  
  const [selectedPrimaryThemes, setSelectedPrimaryThemes] = useState<string[]>(initialPrimaryThemes);
  const [selectedSubThemes, setSelectedSubThemes] = useState<string[]>(initialSubThemes);
  
  // Fetch sources data for the prompt template
  const { data: sources } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .order('priority_tier');
        
      if (error) throw error;
      return data || [];
    }
  });

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
        primary: initialPrimaryThemes,
        sub: initialSubThemes,
        professions: metadata?.search_settings?.selected_themes?.professions || [],
      },
      test_keyword: "",
    },
  });
  
  // Keep track of the search settings in a single state object for easier access by child components
  const [searchSettings, setSearchSettings] = useState({
    domain_filter: metadata?.search_settings?.domain_filter || "auto",
    recency_filter: metadata?.search_settings?.recency_filter || "day",
    temperature: metadata?.search_settings?.temperature || 0.7,
    max_tokens: metadata?.search_settings?.max_tokens || 1500,
    is_news_search: true,
  });
  
  // Update form values and search settings when form fields change
  const handleSearchSettingChange = (key: string, value: any) => {
    setSearchSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    form.setValue(`search_settings.${key}` as any, value);
  };

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
          selected_themes: {
            primary: selectedPrimaryThemes,
            sub: selectedSubThemes,
            professions: data.selected_themes?.professions || []
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
        toast.success("Prompt updated successfully");
      } else {
        await createPrompt(promptData);
        toast.success("Prompt created successfully");
      }
      
      onSave(promptData);
    } catch (error: any) {
      console.error("Error saving prompt:", error);
      toast.error(`Failed to save prompt: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestPrompt = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      
      const testKeyword = form.getValues("test_keyword");
      if (!testKeyword) {
        toast.error("Please enter a test keyword");
        return;
      }
      
      // Example implementation of testing a prompt with a keyword
      // This would call your Supabase Edge Function to test the prompt
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: form.getValues("prompt_text"),
          model: form.getValues("model"),
          input_data: {
            search_query: testKeyword
          },
          include_clusters: form.getValues("include_clusters"),
          include_tracking_summary: form.getValues("include_tracking_summary"),
          include_sources_map: form.getValues("include_sources_map")
        }
      });
      
      if (error) throw error;
      
      setTestResult(data.output);
      toast.success("Test completed successfully");
    } catch (error: any) {
      console.error("Error testing prompt:", error);
      toast.error(`Failed to test prompt: ${error.message || "Unknown error"}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Get current form values for template generation
  const currentFormValues = form.getValues();

  // Extract unique primary and sub themes
  const primaryThemeOptions = Array.from(new Set(clusters?.map(c => c.primary_theme) || []));
  const subThemeOptions = Array.from(new Set(clusters?.map(c => c.sub_theme) || []));
  
  const handlePrimaryThemeSelect = (theme: string) => {
    if (selectedPrimaryThemes.includes(theme)) {
      setSelectedPrimaryThemes(selectedPrimaryThemes.filter(t => t !== theme));
    } else {
      setSelectedPrimaryThemes([...selectedPrimaryThemes, theme]);
    }
  };
  
  const handleSubThemeSelect = (theme: string) => {
    if (selectedSubThemes.includes(theme)) {
      setSelectedSubThemes(selectedSubThemes.filter(t => t !== theme));
    } else {
      setSelectedSubThemes([...selectedSubThemes, theme]);
    }
  };

  // Comprehensive model options including Perplexity-specific options
  const modelOptions = [
    { value: "gpt-4o", label: "GPT-4o", description: "Best for complex analysis and reasoning" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5", description: "Faster, good for simpler tasks" },
    { value: "claude-3-opus", label: "Claude 3 Opus", description: "High quality, slower" },
    { value: "claude-3-sonnet", label: "Claude 3 Sonnet", description: "Balanced speed/quality" },
    { value: "llama-3.1-sonar-small-128k-online", label: "Llama 3.1 Sonar Small", description: "Fast with online search capability" },
    { value: "llama-3.1-sonar-large-128k-online", label: "Llama 3.1 Sonar Large", description: "More powerful with online search capability" },
    { value: "perplexity/sonar-small-online", label: "Perplexity Sonar Small", description: "Efficient with real-time search" },
    { value: "perplexity/sonar-medium-online", label: "Perplexity Sonar Medium", description: "Balanced with real-time search" },
    { value: "perplexity/sonar-large-online", label: "Perplexity Sonar Large", description: "Most powerful with real-time search" },
    { value: "perplexity/pplx-7b-online", label: "PPLX 7B Online", description: "Fast online search model" },
    { value: "perplexity/pplx-70b-online", label: "PPLX 70B Online", description: "Powerful online search model" },
    { value: "perplexity/llama-3.1-turbo-8192-online", label: "Llama 3.1 Turbo Online", description: "Fast with online search" },
  ];

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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="search">Search Parameters</TabsTrigger>
                <TabsTrigger value="template">Prompt Template</TabsTrigger>
                <TabsTrigger value="test">Test</TabsTrigger>
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
                      onValueChange={(value) => {
                        handleSearchSettingChange("model", value);
                      }}
                      defaultValue={form.getValues("model")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
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
                    
                    <div className="mt-2 text-sm">
                      {form.watch("model").includes("sonar") || 
                       form.watch("model").includes("online") || 
                       form.watch("model").includes("perplexity") ? (
                        <Alert className="bg-blue-50">
                          <Info className="h-4 w-4" />
                          <AlertTitle>Online search capability</AlertTitle>
                          <AlertDescription>
                            This model can search the internet for up-to-date information
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Standard model</AlertTitle>
                          <AlertDescription>
                            This model does not have real-time search capability
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
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
                      onValueChange={(value) => {
                        handleSearchSettingChange("domain_filter", value);
                      }}
                      defaultValue={searchSettings.domain_filter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select domain filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (Based on query)</SelectItem>
                        <SelectItem value="news">News Sites Only</SelectItem>
                        <SelectItem value="finance">Finance & Business</SelectItem>
                        <SelectItem value="realestate">Real Estate</SelectItem>
                        <SelectItem value="gov">Government Sources</SelectItem>
                        <SelectItem value="blogs">Blogs & Opinion</SelectItem>
                        <SelectItem value="research">Research & Reports</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="recency_filter">Recency Filter</Label>
                    <Select 
                      onValueChange={(value) => {
                        handleSearchSettingChange("recency_filter", value);
                      }}
                      defaultValue={searchSettings.recency_filter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select recency filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30m">Last 30 Minutes</SelectItem>
                        <SelectItem value="hour">Last Hour</SelectItem>
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
                        value={searchSettings.temperature}
                        onChange={(e) => form.setValue("search_settings.temperature", parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <span className="text-sm font-mono w-10">
                        {searchSettings.temperature}
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Theme Selection</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Select themes to include in your prompt for better context
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {isLoadingClusters ? (
                    <div>Loading clusters...</div>
                  ) : (
                    <>
                      <div>
                        <h4 className="text-sm font-medium mb-2">Primary Themes</h4>
                        <div className="flex flex-wrap gap-2">
                          {primaryThemeOptions.map((theme) => (
                            <Badge 
                              key={theme}
                              variant={selectedPrimaryThemes.includes(theme) ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => handlePrimaryThemeSelect(theme)}
                            >
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-2">Sub Themes</h4>
                        <div className="flex flex-wrap gap-2">
                          {subThemeOptions.map((theme) => (
                            <Badge 
                              key={theme}
                              variant={selectedSubThemes.includes(theme) ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => handleSubThemeSelect(theme)}
                            >
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="template" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="prompt_text">Prompt Template</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            This template is automatically generated based on your selections from the Search Parameters tab.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {/* Pass additional props to the template component */}
                  <NewsSearchPromptTemplate 
                    value={form.watch("prompt_text")}
                    onChange={(value) => form.setValue("prompt_text", value)}
                    clusters={clusters || []}
                    sources={sources || []}
                    searchSettings={searchSettings}
                    selectedThemes={selectedPrimaryThemes}
                  />
                  
                  {form.formState.errors.prompt_text && (
                    <p className="text-sm text-red-500">{form.formState.errors.prompt_text.message}</p>
                  )}
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
                
                <div className="flex justify-end">
                  {onSwitchToAdvanced && (
                    <Button type="button" variant="secondary" onClick={onSwitchToAdvanced}>
                      Switch to Advanced Editor
                    </Button>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="test" className="space-y-4 pt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="test_keyword">Test with Keyword</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Enter a keyword to test how this prompt will search for real news articles about that topic. This simulates what would happen when this prompt runs in production.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>About testing prompts</AlertTitle>
                    <AlertDescription>
                      Testing a prompt helps verify that it will correctly find and format news articles. 
                      Enter a relevant keyword (like "mortgage rates" or "housing policy") to see a sample of 
                      articles the prompt would return when run with the real news API.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex gap-2">
                    <Input
                      id="test_keyword"
                      placeholder="e.g., mortgage rates"
                      {...form.register("test_keyword")}
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      onClick={handleTestPrompt}
                      disabled={isTesting}
                    >
                      {isTesting ? "Testing..." : "Test Prompt"}
                    </Button>
                  </div>
                  
                  {testResult && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Test Result</h4>
                      <div className="bg-muted p-4 rounded-md overflow-auto max-h-[400px]">
                        <pre className="whitespace-pre-wrap text-sm">{testResult}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="secondary" onClick={onCancel}>
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
