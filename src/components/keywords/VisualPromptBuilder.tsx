import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import ClusterWeightEditor from "./ClusterWeightEditor";

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
    recency_filter: z.string().default("day"),
    temperature: z.number().min(0).max(1).default(0.7),
    max_tokens: z.number().min(100).max(4000).default(1500),
    limit: z.number().min(1).max(50).default(10),
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
  const [currentModel, setCurrentModel] = useState<string>("llama-3.1-sonar-small-128k-online");
  
  // Theme selection state
  const [selectedPrimaryThemes, setSelectedPrimaryThemes] = useState<string[]>([]);
  const [selectedSubThemes, setSelectedSubThemes] = useState<string[]>([]);
  
  // Prompt-specific cluster weights (not saved to database)
  const [promptWeights, setPromptWeights] = useState<Record<string, number>>({});
  
  // Track manual changes to prevent resets
  const [hasManualWeightChanges, setHasManualWeightChanges] = useState(false);
  
  // Track the current prompt ID to detect when we're switching to a different prompt
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  // Extract metadata from the initial prompt if it exists
  const metadata = initialPrompt ? extractPromptMetadata(initialPrompt) : null;
  
  // Fetch available models from database
  const { data: availableModels, isLoading: modelsLoading } = useQuery({
    queryKey: ['available-models'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_available_models');
      if (error) throw error;
      return data || [];
    }
  });
  
  // Fetch clusters for keyword clustering
  const { data: clusters, isLoading: isLoadingClusters } = useQuery({
    queryKey: ['keyword-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('id, primary_theme, sub_theme, description, keywords, professions, priority_weight')
        .order('primary_theme');
        
      if (error) throw error;
      return data || [];
    }
  });
  
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

  // Extract clean prompt text without metadata comment
  const getCleanPromptText = (promptText: string) => {
    if (promptText.startsWith("/*")) {
      const endIndex = promptText.indexOf("*/");
      if (endIndex !== -1) {
        return promptText.substring(endIndex + 2).trim();
      }
    }
    return promptText;
  };

  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      function_name: "",
      model: "llama-3.1-sonar-small-128k-online",
      prompt_text: "",
      include_clusters: false,
      include_tracking_summary: false,
      include_sources_map: false,
      is_active: true,
      search_settings: {
        domain_filter: "auto",
        recency_filter: "day",
        temperature: 0.7,
        max_tokens: 1500,
        limit: 10,
        is_news_search: true,
      },
      selected_themes: {
        primary: [],
        sub: [],
        professions: [],
      },
      test_keyword: "",
    },
  });
  
  // Fixed useEffect - only reset when the prompt ID actually changes, not on manual edits
  useEffect(() => {
    const newPromptId = initialPrompt?.id || null;
    
    // Only reset if we're switching to a different prompt (including from null to a prompt or vice versa)
    if (newPromptId !== currentPromptId) {
      console.log('Prompt changed, resetting form. Old ID:', currentPromptId, 'New ID:', newPromptId);
      
      if (initialPrompt) {
        const metadata = extractPromptMetadata(initialPrompt);
        const cleanPromptText = getCleanPromptText(initialPrompt.prompt_text);
        
        // Extract prompt-specific weights from metadata
        const savedPromptWeights = metadata?.search_settings?.prompt_weights || {};
        setPromptWeights(savedPromptWeights);
        
        form.reset({
          function_name: initialPrompt.function_name,
          model: initialPrompt.model,
          prompt_text: cleanPromptText,
          include_clusters: initialPrompt.include_clusters,
          include_tracking_summary: initialPrompt.include_tracking_summary,
          include_sources_map: initialPrompt.include_sources_map,
          is_active: initialPrompt.is_active,
          search_settings: {
            domain_filter: metadata?.search_settings?.domain_filter || "auto",
            recency_filter: metadata?.search_settings?.recency_filter || "day",
            temperature: metadata?.search_settings?.temperature || 0.7,
            max_tokens: metadata?.search_settings?.max_tokens || 1500,
            limit: metadata?.search_settings?.limit || 10,
            is_news_search: true,
          },
          selected_themes: {
            primary: metadata?.search_settings?.selected_themes?.primary || [],
            sub: metadata?.search_settings?.selected_themes?.sub || [],
            professions: metadata?.search_settings?.selected_themes?.professions || [],
          },
          test_keyword: "",
        });

        setCurrentModel(initialPrompt.model);
        setSelectedPrimaryThemes(metadata?.search_settings?.selected_themes?.primary || []);
        setSelectedSubThemes(metadata?.search_settings?.selected_themes?.sub || []);
        setSearchSettings({
          domain_filter: metadata?.search_settings?.domain_filter || "auto",
          recency_filter: metadata?.search_settings?.recency_filter || "day",
          temperature: metadata?.search_settings?.temperature || 0.7,
          max_tokens: metadata?.search_settings?.max_tokens || 1500,
          limit: metadata?.search_settings?.limit || 10,
          is_news_search: true,
        });
      } else {
        // Reset form for new prompt
        form.reset();
        setCurrentModel("llama-3.1-sonar-small-128k-online");
        setSelectedPrimaryThemes([]);
        setSelectedSubThemes([]);
        setPromptWeights({});
        setSearchSettings({
          domain_filter: "auto",
          recency_filter: "day",
          temperature: 0.7,
          max_tokens: 1500,
          limit: 10,
          is_news_search: true,
        });
      }
      
      // Reset manual changes flag and update current prompt ID
      setHasManualWeightChanges(false);
      setCurrentPromptId(newPromptId);
    }
  }, [initialPrompt?.id]); // Only depend on the prompt ID, not the entire prompt object
  
  // Keep track of the search settings in a single state object for easier access by child components
  const [searchSettings, setSearchSettings] = useState({
    domain_filter: metadata?.search_settings?.domain_filter || "auto",
    recency_filter: metadata?.search_settings?.recency_filter || "day",
    temperature: metadata?.search_settings?.temperature || 0.7,
    max_tokens: metadata?.search_settings?.max_tokens || 1500,
    limit: metadata?.search_settings?.limit || 10,
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

  useEffect(() => {
    // Update model state when it changes in the form
    const subscription = form.watch((value, { name }) => {
      if (name === 'model' && value.model) {
        setCurrentModel(value.model as string);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch]);

  // Initialize prompt weights from database weights when clusters load
  useEffect(() => {
    if (clusters && Object.keys(promptWeights).length === 0) {
      const initialWeights: Record<string, number> = {};
      clusters.forEach(cluster => {
        initialWeights[cluster.sub_theme] = cluster.priority_weight || 0;
      });
      setPromptWeights(initialWeights);
    }
  }, [clusters, promptWeights]);

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

  const handleBulkSubThemeSelect = (themes: string[], shouldSelect: boolean) => {
    console.log('Bulk selection:', { themes, shouldSelect, currentSelected: selectedSubThemes });
    
    if (shouldSelect) {
      // Add themes that aren't already selected
      const newThemes = themes.filter(theme => !selectedSubThemes.includes(theme));
      setSelectedSubThemes([...selectedSubThemes, ...newThemes]);
    } else {
      // Remove themes that are currently selected
      setSelectedSubThemes(selectedSubThemes.filter(theme => !themes.includes(theme)));
    }
  };

  const handleWeightChange = (subTheme: string, weight: number) => {
    console.log('Weight changed for', subTheme, 'to', weight);
    setPromptWeights(prev => ({
      ...prev,
      [subTheme]: weight
    }));
    setHasManualWeightChanges(true);
  };

  // Fixed normalize function that handles zero weights properly
  const handleNormalizeWeights = () => {
    console.log('Normalize weights called. Current weights:', promptWeights);
    console.log('Selected sub themes:', selectedSubThemes);
    
    const selectedClusters = clusters?.filter(c => selectedSubThemes.includes(c.sub_theme)) || [];
    
    if (selectedClusters.length === 0) return;
    
    const currentTotalWeight = selectedClusters.reduce((sum, cluster) => 
      sum + (promptWeights[cluster.sub_theme] || 0), 0
    );
    
    console.log('Current total weight:', currentTotalWeight);
    
    const normalizedWeights: Record<string, number> = {};
    
    if (currentTotalWeight === 0) {
      // If total weight is 0, assign equal weights to all selected clusters
      const equalWeight = Math.round(100 / selectedClusters.length);
      selectedClusters.forEach((cluster, index) => {
        // Ensure the total adds up to exactly 100 by adjusting the last item
        normalizedWeights[cluster.sub_theme] = index === selectedClusters.length - 1 
          ? 100 - (equalWeight * (selectedClusters.length - 1))
          : equalWeight;
      });
    } else {
      // Use proportional normalization for non-zero weights
      selectedClusters.forEach(cluster => {
        const currentWeight = promptWeights[cluster.sub_theme] || 0;
        normalizedWeights[cluster.sub_theme] = Math.round((currentWeight / currentTotalWeight) * 100);
      });
    }
    
    console.log('Normalized weights:', normalizedWeights);
    
    setPromptWeights(prev => ({
      ...prev,
      ...normalizedWeights
    }));
    setHasManualWeightChanges(true);
  };

  const handleSubmit = async (data: PromptFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Create metadata JSON to embed in the prompt text
      const metadata = {
        search_settings: {
          domain_filter: data.search_settings?.domain_filter || "auto",
          recency_filter: data.search_settings?.recency_filter || "day",
          temperature: data.search_settings?.temperature || 0.7,
          max_tokens: data.search_settings?.max_tokens || 1500,
          limit: data.search_settings?.limit || 10,
          is_news_search: true,
          selected_themes: {
            primary: selectedPrimaryThemes,
            sub: selectedSubThemes,
            professions: data.selected_themes?.professions || []
          },
          prompt_weights: promptWeights
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
      
      // Reset manual changes flag after successful save
      setHasManualWeightChanges(false);
      
      onSave(promptData);
    } catch (error: any) {
      console.error("Error saving prompt:", error);
      toast.error(`Failed to save prompt: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if the selected model has online search capabilities
  const hasOnlineSearch = (modelName: string): boolean => {
    return (
      modelName.includes('sonar') || 
      modelName.includes('online') || 
      modelName.includes('perplexity')
    );
  };

  // Create clusters with prompt-specific weights for the template
  const clustersWithPromptWeights = clusters?.map(cluster => ({
    ...cluster,
    priority_weight: promptWeights[cluster.sub_theme] || cluster.priority_weight || 0
  })) || [];

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
                <TabsTrigger value="test">Preview</TabsTrigger>
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
                        form.setValue("model", value);
                        setCurrentModel(value);
                      }}
                      value={form.watch("model")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelsLoading ? (
                          <div className="text-sm text-muted-foreground p-2">Loading models...</div>
                        ) : availableModels && availableModels.length > 0 ? (
                          availableModels.map((model) => (
                            <SelectItem key={`${model.provider}-${model.model_name}`} value={model.model_name}>
                              <div className="flex flex-col">
                                <span>{model.model_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {model.provider} - {model.model_name.includes('sonar') ? 'Online search capability' : 'Standard model'}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground p-2">No models available. Please check your API keys.</div>
                        )}
                      </SelectContent>
                    </Select>
                    
                    <div className="mt-2 text-sm">
                      {hasOnlineSearch(currentModel) ? (
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
                      value={searchSettings.domain_filter}
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
                    <p className="text-xs text-muted-foreground mt-1">
                      "Auto" intelligently adapts domain preferences based on search query content and context.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="recency_filter">Recency Filter</Label>
                    <Select 
                      onValueChange={(value) => {
                        handleSearchSettingChange("recency_filter", value);
                      }}
                      value={searchSettings.recency_filter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select recency filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30m">Last 30 Minutes</SelectItem>
                        <SelectItem value="hour">Last Hour</SelectItem>
                        <SelectItem value="day">Last 24 Hours</SelectItem>
                        <SelectItem value="48h">Last 48 Hours</SelectItem>
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
                        onChange={(e) => handleSearchSettingChange("temperature", parseFloat(e.target.value))}
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
                      value={searchSettings.max_tokens}
                      onChange={(e) => handleSearchSettingChange("max_tokens", Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum length of the generated response
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="limit">Article Limit</Label>
                    <Input
                      id="limit"
                      type="number"
                      min="1"
                      max="50"
                      value={searchSettings.limit}
                      onChange={(e) => handleSearchSettingChange("limit", Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of articles to return (1-50)
                    </p>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Cluster Weight Management</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Adjust weights for this specific prompt. These weights are saved with the prompt and don't affect global cluster weights.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {isLoadingClusters ? (
                    <div>Loading clusters...</div>
                  ) : (
                    <ClusterWeightEditor
                      clusters={clusters || []}
                      selectedPrimaryThemes={selectedPrimaryThemes}
                      selectedSubThemes={selectedSubThemes}
                      promptWeights={promptWeights}
                      onPrimaryThemeSelect={handlePrimaryThemeSelect}
                      onSubThemeSelect={handleSubThemeSelect}
                      onBulkSubThemeSelect={handleBulkSubThemeSelect}
                      onWeightChange={handleWeightChange}
                      onNormalizeWeights={handleNormalizeWeights}
                    />
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="test" className="space-y-4 pt-4">
                <div className="space-y-4">
                  <div className="space-y-2 mt-4">
                    <h4 className="text-sm font-medium">Generated Prompt Preview</h4>
                    <Alert variant="default" className="bg-blue-50">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Preview Mode</AlertTitle>
                      <AlertDescription>
                        This preview uses your selected themes and custom weights. The prompt will be generated automatically and can be edited below.
                      </AlertDescription>
                    </Alert>
                    
                    <NewsSearchPromptTemplate
                      value={form.watch("prompt_text")}
                      onChange={(value) => form.setValue("prompt_text", value)}
                      clusters={clustersWithPromptWeights}
                      sources={sources || []}
                      searchSettings={searchSettings}
                      selectedThemes={selectedPrimaryThemes}
                      readOnly={false}
                    />
                  </div>
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
