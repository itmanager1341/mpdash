import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Info, Wand2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NewsFetchPromptFormProps {
  initialData?: LlmPrompt | null;
  onSave?: () => void;
  onCancel?: () => void;
  onSwitchToVisual?: () => void;
}

interface FormValues {
  function_name: string;
  model: string;
  prompt_text: string;
  include_clusters: boolean;
  include_tracking_summary: boolean;
  include_sources_map: boolean;
  is_active: boolean;
  search_domain_filter: string;
  search_recency_filter: string;
  temperature: number;
  max_tokens: number;
  is_news_search: boolean;
}

export default function NewsFetchPromptForm({
  initialData,
  onSave,
  onCancel,
  onSwitchToVisual
}: NewsFetchPromptFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: initialData ? {
      ...initialData,
      search_domain_filter: 'auto',
      search_recency_filter: 'day',
      temperature: 0.2,
      max_tokens: 1000,
      is_news_search: true
    } : {
      function_name: 'news_search_',
      model: 'llama-3.1-sonar-small-128k-online',
      prompt_text: 'Search for the latest news and developments related to the following topic:\n\n[QUERY]\n\nFocus on information relevant to the mortgage industry and housing market. Look for data points, trends, and expert opinions. Organize your findings by source credibility.',
      include_clusters: true,
      include_tracking_summary: true,
      include_sources_map: false,
      is_active: true,
      search_domain_filter: 'auto',
      search_recency_filter: 'day',
      temperature: 0.2,
      max_tokens: 1000,
      is_news_search: true
    }
  });

  // Fetch available models that are assigned to news search functions
  const { data: availableModels, isLoading: modelsLoading } = useQuery({
    queryKey: ['available-news-search-models'],
    queryFn: async () => {
      // Get all available models first
      const { data: allModels, error } = await supabase.rpc('get_available_models');
      if (error) throw error;
      
      // For now, filter to models that are typically used for news search
      // In a full implementation, this would check the actual function assignments
      const newsSearchModels = allModels?.filter(model => 
        model.model_name.includes('sonar') ||
        model.model_name.includes('online') ||
        model.model_name.includes('perplexity') ||
        model.provider === 'perplexity'
      ) || [];
      
      return newsSearchModels;
    }
  });

  const { data: clusters } = useQuery({
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

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Extract special fields for metadata
      const { search_domain_filter, search_recency_filter, temperature, max_tokens, is_news_search, ...basePrompt } = data;
      
      // Create metadata object
      const metadata = {
        search_settings: {
          domain_filter: search_domain_filter,
          recency_filter: search_recency_filter,
          temperature,
          max_tokens,
          is_news_search
        }
      };
      
      // Convert to JSON string and store in prompt_text as a comment block at the top
      const metadataComment = `/*\n${JSON.stringify(metadata, null, 2)}\n*/\n`;
      const promptWithMetadata = {
        ...basePrompt,
        prompt_text: metadataComment + basePrompt.prompt_text
      };
      
      if (initialData?.id) {
        const { error } = await supabase
          .from('llm_prompts')
          .update(promptWithMetadata)
          .eq('id', initialData.id);
          
        if (error) throw error;
        return { success: true, id: initialData.id };
      } else {
        const { data, error } = await supabase
          .from('llm_prompts')
          .insert(promptWithMetadata)
          .select('id')
          .single();
          
        if (error) throw error;
        return { success: true, id: data.id };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-prompts'] });
      toast.success(initialData ? 'News search prompt updated' : 'News search prompt created');
      if (onSave) onSave();
    },
    onError: (error) => {
      toast.error('Error saving news search prompt: ' + error.message);
    }
  });

  const handleFormSubmit = (data: FormValues) => {
    saveMutation.mutate(data);
  };

  // Extract metadata from prompt text if present
  useEffect(() => {
    if (initialData?.prompt_text) {
      const metadataMatch = initialData.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
      if (metadataMatch) {
        try {
          const metadata = JSON.parse(metadataMatch[1]);
          if (metadata.search_settings) {
            setValue('search_domain_filter', metadata.search_settings.domain_filter || 'auto');
            setValue('search_recency_filter', metadata.search_settings.recency_filter || 'day');
            setValue('temperature', metadata.search_settings.temperature || 0.2);
            setValue('max_tokens', metadata.search_settings.max_tokens || 1000);
            setValue('is_news_search', metadata.search_settings.is_news_search !== false);
            
            // Remove metadata block from prompt text
            setValue('prompt_text', initialData.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, ''));
          }
        } catch (e) {
          console.error("Error parsing metadata from prompt:", e);
        }
      }
    }
  }, [initialData, setValue]);

  const recencyOptions = [
    { label: '30 minutes', value: '30m' },
    { label: 'Hour', value: 'hour' },
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
  ];

  const domainOptions = [
    { label: 'Automatic', value: 'auto' },
    { label: 'Finance & Business', value: 'finance' },
    { label: 'Real Estate', value: 'realestate' },
    { label: 'News', value: 'news' },
    { label: 'Government', value: 'gov' },
  ];

  const selectedModel = watch('model');
  const isPerplexityModel = selectedModel?.includes('sonar') || selectedModel?.includes('online');
  const isNewsSearch = watch('is_news_search');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{initialData ? 'Edit News Search Prompt' : 'Create News Search Prompt'}</CardTitle>
        <CardDescription>Configure a specialized prompt for fetching mortgage industry news</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="space-y-4">
            {/* Add structured prompt builder button */}
            <Alert>
              <Wand2 className="h-4 w-4" />
              <AlertTitle>Try our new structured prompt builder</AlertTitle>
              <AlertDescription>
                Create optimized news search prompts with our visual builder that leverages your clusters and sources.
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={onSwitchToVisual}>
                    Switch to Visual Builder
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="function_name">Function Name</Label>
                <Input 
                  id="function_name" 
                  placeholder="e.g., news_search_mortgage_rates" 
                  {...register('function_name', { required: true })} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                {modelsLoading ? (
                  <div className="text-sm text-muted-foreground">Loading available models...</div>
                ) : (
                  <Select 
                    defaultValue={watch('model')} 
                    onValueChange={(value) => setValue('model', value)}
                  >
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels?.map((model) => (
                        <SelectItem key={`${model.provider}-${model.model_name}`} value={model.model_name}>
                          {model.model_name} ({model.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {isPerplexityModel ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    This model has online search capability for real-time news.
                  </p>
                ) : selectedModel && !isPerplexityModel ? (
                  <p className="text-xs text-amber-600 mt-1">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    This model doesn't have real-time search capability.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="prompt_text">Prompt Template</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? "Hide Advanced" : "Show Advanced"}
                </Button>
              </div>
              <Textarea 
                id="prompt_text" 
                rows={8}
                placeholder="Enter your prompt template here... Use [QUERY] as a placeholder for the search term."
                {...register('prompt_text', { required: true })} 
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">[QUERY]</code> as a placeholder for the search term. 
                Use <code className="bg-muted px-1 rounded">[CLUSTERS]</code> to include relevant keyword clusters.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_news_search"
                checked={watch('is_news_search')}
                onCheckedChange={(checked) => setValue('is_news_search', checked)}
              />
              <Label htmlFor="is_news_search" className="cursor-pointer">
                Specialized News Search
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 inline-block ml-1 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        When enabled, this prompt will be used specifically for the Perplexity news fetch functionality 
                        and will appear in the news search settings.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={watch('is_active')}
                onCheckedChange={(checked) => setValue('is_active', checked)}
              />
              <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
            </div>

            {showAdvanced && (
              <div className="pt-4 border-t space-y-4">
                <h4 className="text-sm font-medium">Advanced Settings</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isPerplexityModel && isNewsSearch && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="search_recency_filter">Search Recency</Label>
                        <Select 
                          defaultValue={watch('search_recency_filter')} 
                          onValueChange={(value) => setValue('search_recency_filter', value)}
                        >
                          <SelectTrigger id="search_recency_filter">
                            <SelectValue placeholder="Select recency filter" />
                          </SelectTrigger>
                          <SelectContent>
                            {recencyOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="search_domain_filter">Domain Filter</Label>
                        <Select 
                          defaultValue={watch('search_domain_filter')} 
                          onValueChange={(value) => setValue('search_domain_filter', value)}
                        >
                          <SelectTrigger id="search_domain_filter">
                            <SelectValue placeholder="Select domain filter" />
                          </SelectTrigger>
                          <SelectContent>
                            {domainOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="temperature"
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        className="w-full"
                        value={watch('temperature')}
                        onChange={(e) => setValue('temperature', parseFloat(e.target.value))}
                      />
                      <span className="w-10 text-sm">{watch('temperature')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lower values produce more focused results.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_tokens">Max Tokens</Label>
                    <Input
                      id="max_tokens"
                      type="number"
                      min="100"
                      max="4000"
                      step="100"
                      {...register('max_tokens', { 
                        valueAsNumber: true,
                        min: 100,
                        max: 4000
                      })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include_clusters"
                      checked={watch('include_clusters')}
                      onCheckedChange={(checked) => setValue('include_clusters', checked)}
                    />
                    <Label htmlFor="include_clusters" className="cursor-pointer">Include Clusters</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include_tracking_summary"
                      checked={watch('include_tracking_summary')}
                      onCheckedChange={(checked) => setValue('include_tracking_summary', checked)}
                    />
                    <Label htmlFor="include_tracking_summary" className="cursor-pointer">Include Tracking Summary</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include_sources_map"
                      checked={watch('include_sources_map')}
                      onCheckedChange={(checked) => setValue('include_sources_map', checked)}
                    />
                    <Label htmlFor="include_sources_map" className="cursor-pointer">Include Sources Map</Label>
                  </div>
                </div>

                {watch('include_clusters') && clusters && clusters.length > 0 && (
                  <Alert className="bg-muted/50">
                    <AlertTitle className="text-sm font-medium flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Cluster Context Available
                    </AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground">
                      Your prompt will have access to {clusters.length} keyword clusters from your database.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
          
          <div className="flex justify-between gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              {onSwitchToVisual && (
                <Button type="button" variant="secondary" onClick={onSwitchToVisual}>
                  Switch to Visual Builder
                </Button>
              )}
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : initialData ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
