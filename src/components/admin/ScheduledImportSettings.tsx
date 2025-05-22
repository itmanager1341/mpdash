
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckIcon, EyeIcon, FileEdit, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Type guard function to check if parameters have expected properties
const hasJobParameters = (params: any): params is { 
  minScore: number, 
  limit: number, 
  keywords: string[],
  promptId?: string
} => {
  return params && 
    typeof params === 'object' && 
    ('minScore' in params || 'limit' in params || 'keywords' in params);
};

// Default keywords to use if none are provided
const DEFAULT_KEYWORDS = [
  "mortgage rates", 
  "housing market", 
  "federal reserve", 
  "interest rates", 
  "home equity", 
  "foreclosure"
];

export default function ScheduledImportSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    schedule: "0 */12 * * *", // Default: every 12 hours
    isEnabled: true,
    minScore: "0.6",
    limit: "10",
    keywords: DEFAULT_KEYWORDS.join("\n"),
  });
  const [useEnhancedPrompt, setUseEnhancedPrompt] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState("");

  const { data: job, isLoading: isLoadingJob } = useQuery({
    queryKey: ["scheduled-job-news-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_job_settings")
        .select("*")
        .eq("job_name", "news_import")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: prompts, isLoading: isLoadingPrompts } = useQuery({
    queryKey: ["news-search-prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("llm_prompts")
        .select("*")
        .eq("is_active", true)
        .order("function_name");

      if (error) throw error;

      // Filter to only include news search prompts
      return (data || []).filter(prompt => {
        // Check if prompt has news search metadata or name indicates news search
        const metadataMatch = prompt.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
        if (metadataMatch) {
          try {
            const metadata = JSON.parse(metadataMatch[1]);
            return metadata.search_settings?.is_news_search === true;
          } catch (e) {
            return false;
          }
        }
        return prompt.function_name?.includes('news_search');
      });
    },
  });

  // Update form with job data when loaded
  useEffect(() => {
    if (job) {
      const params = job.parameters;
      const jobParams = hasJobParameters(params) ? params : { minScore: 0.6, limit: 10, keywords: DEFAULT_KEYWORDS };
      
      // If keywords array is empty, use the defaults
      const keywordsArray = Array.isArray(jobParams.keywords) && jobParams.keywords.length > 0 
        ? jobParams.keywords 
        : DEFAULT_KEYWORDS;
      
      setFormData({
        schedule: job.schedule || "0 */12 * * *",
        isEnabled: job.is_enabled,
        minScore: jobParams.minScore?.toString() || "0.6",
        limit: jobParams.limit?.toString() || "10",
        keywords: keywordsArray.join("\n"),
      });

      setUseEnhancedPrompt(!!jobParams.promptId);
      setSelectedPromptId(jobParams.promptId || "");
    }
  }, [job]);

  // Function to save the job settings
  const saveJobMutation = useMutation({
    mutationFn: async (formData: any) => {
      setIsLoading(true);

      const keywordsArray = formData.keywords
        .split("\n")
        .map((k: string) => k.trim())
        .filter((k: string) => k);

      // If keywords array is empty after filtering, use defaults
      const finalKeywords = keywordsArray.length > 0 ? keywordsArray : DEFAULT_KEYWORDS;

      const jobData = {
        job_name: "news_import",
        schedule: formData.schedule,
        is_enabled: formData.isEnabled,
        parameters: {
          minScore: parseFloat(formData.minScore),
          limit: parseInt(formData.limit),
          keywords: finalKeywords,
        } as Record<string, any>, // Use type assertion to allow adding promptId
      };

      // Add promptId if selected
      if (useEnhancedPrompt && selectedPromptId) {
        jobData.parameters.promptId = selectedPromptId;
      } else {
        // Remove promptId if not using enhanced prompt
        delete jobData.parameters.promptId;
      }

      if (job?.id) {
        // Update existing job
        const { error } = await supabase
          .from("scheduled_job_settings")
          .update(jobData)
          .eq("id", job.id);

        if (error) throw error;
      } else {
        // Create new job
        const { error } = await supabase
          .from("scheduled_job_settings")
          .insert([jobData]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Scheduled import settings saved successfully");
      setIsLoading(false);
    },
    onError: (error) => {
      console.error("Error saving job:", error);
      toast.error("Failed to save scheduled import settings");
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveJobMutation.mutate(formData);
  };

  // Extract schedule parts for easier UI
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  // Update frequency dropdown
  const handleFrequencyChange = (value: string) => {
    let schedule = "";
    
    switch (value) {
      case "hourly":
        schedule = "0 * * * *"; // Every hour
        break;
      case "daily":
        schedule = "0 8 * * *"; // Every day at 8am
        break;
      case "twice-daily":
        schedule = "0 8,20 * * *"; // Every day at 8am and 8pm
        break;
      case "every-12-hours":
        schedule = "0 */12 * * *"; // Every 12 hours
        break;
      case "weekly":
        schedule = "0 8 * * 1"; // Every Monday at 8am
        break;
      default:
        schedule = value; // Use custom value
    }
    
    setFormData({ ...formData, schedule });
  };
  
  // Helper to get current frequency from schedule
  const getCurrentFrequency = () => {
    const schedule = formData.schedule;
    
    if (schedule === "0 * * * *") return "hourly";
    if (schedule === "0 8 * * *") return "daily";
    if (schedule === "0 8,20 * * *") return "twice-daily";
    if (schedule === "0 */12 * * *") return "every-12-hours";
    if (schedule === "0 8 * * 1") return "weekly";
    
    return "custom";
  };
  
  const extractMetadata = (prompt: any | undefined) => {
    if (!prompt) return null;
    
    const metadataMatch = prompt.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
    if (metadataMatch) {
      try {
        return JSON.parse(metadataMatch[1]);
      } catch (e) {
        return null;
      }
    }
    return null;
  };
  
  const getSelectedPrompt = () => {
    return prompts?.find(p => p.id === selectedPromptId);
  };
  
  const generatePreviewPrompt = () => {
    const selectedPrompt = getSelectedPrompt();
    if (!selectedPrompt) return "";
    
    // Remove metadata from prompt text
    let previewText = selectedPrompt.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '');
    
    // Insert first keyword for preview
    const firstKeyword = formData.keywords
      .split("\n")
      .map(k => k.trim())
      .filter(k => k)[0] || "mortgage rates";
      
    if (previewText.includes("[QUERY]")) {
      previewText = previewText.replace("[QUERY]", firstKeyword);
    } else {
      previewText += `\n\nTOPIC: ${firstKeyword}`;
    }
    
    return previewText;
  };
  
  // Update preview when prompt or keywords change
  useEffect(() => {
    if (selectedPromptId) {
      setPreviewPrompt(generatePreviewPrompt());
    }
  }, [selectedPromptId, formData.keywords]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Scheduled News Import</CardTitle>
        <CardDescription>
          Configure automated importing of news articles for editorial review
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="isEnabled" className="text-base">
                Enable Scheduled Import
              </Label>
              <Switch
                id="isEnabled"
                checked={formData.isEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isEnabled: checked })
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Turn on/off automated news fetching
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="frequency">Update Frequency</Label>
            <Select value={getCurrentFrequency()} onValueChange={handleFrequencyChange}>
              <SelectTrigger id="frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="every-12-hours">Every 12 hours</SelectItem>
                <SelectItem value="daily">Daily (8am)</SelectItem>
                <SelectItem value="twice-daily">Twice Daily (8am/8pm)</SelectItem>
                <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            
            {getCurrentFrequency() === "custom" && (
              <div className="pt-2">
                <Input
                  name="schedule"
                  value={formData.schedule}
                  onChange={handleInputChange}
                  placeholder="Cron expression (e.g., 0 */12 * * *)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use cron syntax: minute hour day-of-month month day-of-week
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minScore">Minimum Relevance Score</Label>
              <Input
                id="minScore"
                name="minScore"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={formData.minScore}
                onChange={handleInputChange}
              />
              <p className="text-xs text-muted-foreground">
                Minimum score (0-1) for articles to be imported
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">Article Limit</Label>
              <Input
                id="limit"
                name="limit"
                type="number"
                min="1"
                max="50"
                value={formData.limit}
                onChange={handleInputChange}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of articles to import per run
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="useEnhancedPrompt" className="text-base">
                Use Enhanced Search Prompt
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 inline-block ml-1 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Enhanced prompts provide better context and filtering options for more targeted news results.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Switch
                id="useEnhancedPrompt"
                checked={useEnhancedPrompt}
                onCheckedChange={(checked) => setUseEnhancedPrompt(checked)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Use customized search prompts from the Keyword Management section
            </p>
          </div>
          
          {useEnhancedPrompt && (
            <div className="space-y-2 border-l-4 border-primary/20 pl-4 py-2">
              <Label>Select Search Prompt</Label>
              {isLoadingPrompts ? (
                <p className="text-sm text-muted-foreground">Loading prompts...</p>
              ) : prompts && prompts.length > 0 ? (
                <>
                  <Select
                    value={selectedPromptId}
                    onValueChange={(value) => {
                      setSelectedPromptId(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a search prompt" />
                    </SelectTrigger>
                    <SelectContent>
                      {prompts.map((prompt) => (
                        <SelectItem key={prompt.id} value={prompt.id}>
                          {prompt.function_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedPromptId && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                          {getSelectedPrompt()?.model.includes('llama') ? 'Llama' : getSelectedPrompt()?.model}
                        </Badge>
                        
                        {getSelectedPrompt()?.include_clusters && (
                          <Badge variant="outline">Uses clusters</Badge>
                        )}
                        
                        {(() => {
                          const metadata = extractMetadata(getSelectedPrompt());
                          if (metadata?.search_settings?.recency_filter) {
                            return (
                              <Badge variant="outline">
                                {metadata.search_settings.recency_filter === 'day' ? '24h' : metadata.search_settings.recency_filter}
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      
                      <div className="mt-2 flex gap-2">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                            >
                              <EyeIcon className="h-4 w-4" />
                              Preview Prompt
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="right" className="w-full sm:max-w-lg">
                            <SheetHeader>
                              <SheetTitle>Prompt Preview</SheetTitle>
                              <SheetDescription>
                                This is how the prompt will be used to search for news
                              </SheetDescription>
                            </SheetHeader>
                            <ScrollArea className="h-[80vh] mt-4">
                              <pre className="whitespace-pre-wrap text-sm font-mono p-4 rounded bg-muted">
                                {previewPrompt}
                              </pre>
                            </ScrollArea>
                          </SheetContent>
                        </Sheet>
                        
                        <a href="/keyword-management?tab=maintenance" className="text-xs text-blue-500 hover:text-blue-700 flex items-center">
                          <FileEdit className="h-4 w-4 mr-1" />
                          Manage Prompts
                        </a>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Alert variant="destructive" className="mt-2">
                  <AlertTitle>No search prompts found</AlertTitle>
                  <AlertDescription>
                    Create search prompts in the{" "}
                    <a href="/keyword-management?tab=maintenance" className="underline">
                      Keyword Management
                    </a>{" "}
                    section.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="keywords">Search Keywords</Label>
            <Textarea
              id="keywords"
              name="keywords"
              value={formData.keywords}
              onChange={handleInputChange}
              placeholder="Enter one keyword or phrase per line"
              rows={6}
            />
            <p className="text-sm text-muted-foreground">
              Enter one search phrase per line (e.g., mortgage rates)
            </p>
            
            <Alert className="mt-2 bg-blue-50 text-blue-800 border border-blue-200">
              <Info className="h-4 w-4" />
              <AlertTitle>Default Keywords</AlertTitle>
              <AlertDescription>
                If no keywords are provided, the system will use these defaults: mortgage rates, housing market, federal reserve, interest rates, home equity, foreclosure
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <p className="text-xs text-muted-foreground">
            Last updated:{" "}
            {job?.updated_at
              ? new Date(job.updated_at).toLocaleString()
              : "Never"}
          </p>
          <Button
            type="submit"
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? "Saving..." : "Save Settings"}
            {!isLoading && <CheckIcon className="h-4 w-4" />}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
