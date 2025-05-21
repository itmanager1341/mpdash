
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Info, Wand2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScheduledJobSettings } from "@/types/database";

export default function ScheduledImportSettings() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  
  // Fetch job settings
  const { data: jobSettings, isLoading: isLoadingSettings, error: settingsError, refetch: refetchSettings } = useQuery({
    queryKey: ["job-settings", "daily-perplexity-news-fetch"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-scheduled-job", {
          body: { job_name: "daily-perplexity-news-fetch" },
        });

        if (error) throw error;
        return data as ScheduledJobSettings;
      } catch (error) {
        console.error("Error fetching job settings:", error);
        throw error;
      }
    },
  });

  // Fetch available prompts
  const { data: availablePrompts, isLoading: isLoadingPrompts } = useQuery({
    queryKey: ["llm-prompts", "news-search"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("llm_prompts")
          .select("*")
          .order("function_name");

        if (error) throw error;

        // Filter for news search prompts
        return (data || []).filter(prompt => {
          // Check if the prompt has the news search metadata
          const metadataMatch = prompt.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
          if (metadataMatch) {
            try {
              const metadata = JSON.parse(metadataMatch[1]);
              return metadata.search_settings?.is_news_search === true;
            } catch (e) {
              return false;
            }
          }
          // Also include prompts that have "news" or "search" in their function name
          return prompt.function_name.toLowerCase().includes('news') || 
                 prompt.function_name.toLowerCase().includes('search');
        });
      } catch (error) {
        console.error("Error fetching prompts:", error);
        throw error;
      }
    }
  });

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: {
      is_enabled: true,
      schedule: "0 6 * * *",
      minScore: 2.5,
      keywords: "",
      limit: 20,
      usePrompt: false,
      promptId: "",
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (jobSettings) {
      setValue("is_enabled", jobSettings.is_enabled);
      setValue("schedule", jobSettings.schedule);
      
      const params = jobSettings.parameters as Record<string, any>;
      setValue("minScore", params.minScore || 2.5);
      setValue("limit", params.limit || 20);
      
      if (params.keywords && Array.isArray(params.keywords)) {
        setValue("keywords", params.keywords.join(", "));
      }
      
      setValue("usePrompt", !!params.promptId);
      setValue("promptId", params.promptId || "");
      
      if (params.promptId) {
        setSelectedPrompt(params.promptId);
      }
    }
  }, [jobSettings, setValue]);

  // Update job settings mutation
  const updateJobMutation = useMutation({
    mutationFn: async (formData: any) => {
      // Prepare keywords as array
      let keywordsArray: string[] = [];
      if (typeof formData.keywords === "string") {
        keywordsArray = formData.keywords
          .split(",")
          .map((k: string) => k.trim())
          .filter((k: string) => k.length > 0);
      }

      const settings = {
        is_enabled: formData.is_enabled,
        schedule: formData.schedule,
        parameters: {
          minScore: parseFloat(formData.minScore),
          limit: parseInt(formData.limit),
          keywords: keywordsArray,
        } as Record<string, any>, // Use type assertion to allow adding promptId
      };

      // Add promptId if selected
      if (formData.usePrompt && formData.promptId) {
        settings.parameters.promptId = formData.promptId;
      }

      const { error } = await supabase.functions.invoke("update-scheduled-job", {
        body: {
          job_name: "daily-perplexity-news-fetch",
          settings,
        },
      });

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      toast.success("Job settings updated successfully");
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
      refetchSettings();
    },
    onError: (error) => {
      toast.error(`Failed to update job settings: ${error.message}`);
    },
  });

  const handlePromptChange = (value: string) => {
    setSelectedPrompt(value);
    setValue("promptId", value);
  };

  const handleFormSubmit = (data: any) => {
    updateJobMutation.mutate(data);
  };

  // Find selected prompt details
  const selectedPromptDetails = selectedPrompt && availablePrompts 
    ? availablePrompts.find(p => p.id === selectedPrompt)
    : null;

  // Extract metadata from prompt text if available
  const extractMetadata = (promptText: string) => {
    const metadataMatch = promptText?.match(/\/\*\n([\s\S]*?)\n\*\//);
    if (metadataMatch) {
      try {
        return JSON.parse(metadataMatch[1]);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const promptMetadata = selectedPromptDetails ? extractMetadata(selectedPromptDetails.prompt_text) : null;
  const searchSettings = promptMetadata?.search_settings || {};

  const usePrompt = watch("usePrompt");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Scheduled News Import</span>
          {jobSettings?.is_enabled ? (
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          ) : (
            <Badge variant="outline">Disabled</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Configure the automatic import of news articles from Perplexity AI
        </CardDescription>
      </CardHeader>
      
      {isLoadingSettings ? (
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      ) : settingsError ? (
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Could not load job settings. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_enabled"
                  checked={watch("is_enabled")}
                  onCheckedChange={(checked) => setValue("is_enabled", checked)}
                />
                <Label htmlFor="is_enabled">Enable scheduled job</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule">Cron Schedule</Label>
                <Input
                  id="schedule"
                  {...register("schedule", { required: true })}
                  placeholder="0 6 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Format: minute hour day month weekday (e.g., "0 6 * * *" = daily at 6:00 AM)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minScore">Minimum Score</Label>
                <Input
                  id="minScore"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  {...register("minScore", {
                    required: true,
                    min: 0,
                    max: 10,
                    valueAsNumber: true,
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Only import articles with a relevance score above this threshold (0-10)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limit">Result Limit</Label>
                <Input
                  id="limit"
                  type="number"
                  min="1"
                  max="100"
                  {...register("limit", {
                    required: true,
                    min: 1,
                    max: 100,
                    valueAsNumber: true,
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of articles to import per run
                </p>
              </div>

              {!usePrompt && (
                <div className="space-y-2">
                  <Label htmlFor="keywords">Search Keywords</Label>
                  <Textarea
                    id="keywords"
                    {...register("keywords", { required: !usePrompt })}
                    placeholder="mortgage, housing market, federal reserve, interest rates"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated keywords to search for
                  </p>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="flex items-center space-x-2 mb-4">
                  <Switch
                    id="usePrompt"
                    checked={watch("usePrompt")}
                    onCheckedChange={(checked) => {
                      setValue("usePrompt", checked);
                      if (!checked) {
                        setValue("promptId", "");
                        setSelectedPrompt(null);
                      }
                    }}
                  />
                  <Label htmlFor="usePrompt" className="flex items-center gap-1">
                    <Wand2 className="h-4 w-4" />
                    Use Enhanced Search Prompt
                  </Label>
                </div>

                {usePrompt && (
                  <div className="space-y-4 pl-2 border-l-2 border-muted">
                    {isLoadingPrompts ? (
                      <Skeleton className="h-10 w-full" />
                    ) : availablePrompts && availablePrompts.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="promptId">Select Search Prompt</Label>
                          <Select
                            value={selectedPrompt || ""}
                            onValueChange={handlePromptChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a prompt" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Available Prompts</SelectLabel>
                                {availablePrompts.map((prompt) => (
                                  <SelectItem key={prompt.id} value={prompt.id}>
                                    {prompt.function_name}
                                    {!prompt.is_active && " (Inactive)"}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedPromptDetails && (
                          <Alert className="bg-muted/50">
                            <Info className="h-4 w-4" />
                            <AlertTitle className="text-sm">Prompt Details</AlertTitle>
                            <AlertDescription className="text-xs">
                              <div className="space-y-2 pt-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">
                                    {selectedPromptDetails.model}
                                  </Badge>
                                  {searchSettings.recency_filter && (
                                    <Badge variant="outline">
                                      {searchSettings.recency_filter === '30m' ? '30 minutes' :
                                       searchSettings.recency_filter === 'hour' ? 'Hourly' :
                                       searchSettings.recency_filter === 'day' ? 'Daily' :
                                       searchSettings.recency_filter === 'week' ? 'Weekly' :
                                       searchSettings.recency_filter === 'month' ? 'Monthly' : 
                                       searchSettings.recency_filter}
                                    </Badge>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-1">
                                    {selectedPromptDetails.include_clusters && (
                                      <Badge variant="secondary" className="text-xs">
                                        <CheckCircle className="h-3 w-3 mr-1" /> Clusters
                                      </Badge>
                                    )}
                                    {selectedPromptDetails.include_tracking_summary && (
                                      <Badge variant="secondary" className="text-xs">
                                        <CheckCircle className="h-3 w-3 mr-1" /> Tracking
                                      </Badge>
                                    )}
                                    {selectedPromptDetails.include_sources_map && (
                                      <Badge variant="secondary" className="text-xs">
                                        <CheckCircle className="h-3 w-3 mr-1" /> Sources
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="space-y-2 mt-2">
                                  <Label htmlFor="keywords">Search Keywords (Still Required)</Label>
                                  <Textarea
                                    id="keywords"
                                    {...register("keywords", { required: true })}
                                    placeholder="mortgage, housing market, federal reserve, interest rates"
                                    rows={2}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    These keywords will be used as search terms in the prompt.
                                  </p>
                                </div>
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No prompts available</AlertTitle>
                        <AlertDescription>
                          Create news search prompts in the Keyword Management section.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <p className="text-xs text-muted-foreground pt-2">
              Last run: {jobSettings?.last_run ? new Date(jobSettings.last_run).toLocaleString() : "Never"}
            </p>
            
            <Button type="submit" className="relative" disabled={updateJobMutation.isPending}>
              {isSuccess && (
                <CheckCircle className="absolute h-5 w-5 animate-ping text-green-500" />
              )}
              {updateJobMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
