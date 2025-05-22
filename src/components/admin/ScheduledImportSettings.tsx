
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckIcon, EyeIcon, FileEdit, Import, Info, Loader2 } from "lucide-react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import NewsPromptPreviewDialog from "../keywords/NewsPromptPreviewDialog";
import { extractPromptMetadata } from "@/utils/llmPromptsUtils";

// Type guard function to check if parameters have expected properties
const hasJobParameters = (params: any): params is { 
  minScore: number, 
  limit: number, 
  promptId?: string
} => {
  return params && 
    typeof params === 'object' && 
    ('minScore' in params || 'limit' in params || 'promptId' in params);
};

export default function ScheduledImportSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formData, setFormData] = useState({
    schedule: "0 */12 * * *", // Default: every 12 hours
    isEnabled: true,
    minScore: "0.6",
    limit: "10",
  });
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [selectedPromptForPreview, setSelectedPromptForPreview] = useState<LlmPrompt | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<any>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

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
      const jobParams = hasJobParameters(params) ? params : { minScore: 0.6, limit: 10 };
      
      setFormData({
        schedule: job.schedule || "0 */12 * * *",
        isEnabled: job.is_enabled,
        minScore: jobParams.minScore?.toString() || "0.6",
        limit: jobParams.limit?.toString() || "10",
      });

      setSelectedPromptId(jobParams.promptId || "");
    }
  }, [job]);

  // Function to save the job settings
  const saveJobMutation = useMutation({
    mutationFn: async (formData: any) => {
      setIsLoading(true);

      const jobData = {
        job_name: "news_import",
        schedule: formData.schedule,
        is_enabled: formData.isEnabled,
        parameters: {
          minScore: parseFloat(formData.minScore),
          limit: parseInt(formData.limit),
          promptId: selectedPromptId || null,
        } as Record<string, any>,
      };

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
    
    return previewText;
  };
  
  // Update preview when prompt changes
  useEffect(() => {
    if (selectedPromptId) {
      setPreviewPrompt(generatePreviewPrompt());
    }
  }, [selectedPromptId]);
  
  const handleImportNow = async () => {
    if (!selectedPromptId) {
      toast.error("Please select a search prompt first");
      return;
    }
    
    setIsImporting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { 
          manual: true,
          promptId: selectedPromptId
        }
      });
      
      if (error) {
        throw new Error(`Function error: ${error.message}`);
      }
      
      if (data.success) {
        toast.success(`News import completed: ${data.details?.articles_inserted || 0} new articles added`);
      } else {
        toast.error(`Import failed: ${data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error running news import:", err);
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
      setConfirmImportOpen(false);
    }
  };
  
  const handleShowPreview = () => {
    if (!selectedPromptId) {
      toast.error("Please select a search prompt first");
      return;
    }
    
    const selectedPrompt = getSelectedPrompt();
    if (selectedPrompt) {
      const metadata = extractPromptMetadata(selectedPrompt);
      setSelectedPromptForPreview(selectedPrompt);
      setPreviewMetadata(metadata);
      setIsPreviewDialogOpen(true);
    }
  };

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
                <input
                  name="schedule"
                  value={formData.schedule}
                  onChange={handleInputChange}
                  placeholder="Cron expression (e.g., 0 */12 * * *)"
                  className="w-full p-2 border rounded"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use cron syntax: minute hour day-of-month month day-of-week
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4 border-l-4 border-primary/20 pl-4 py-2">
            <div className="flex items-center justify-between">
              <Label className="text-base">
                Search Prompt
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 inline-block ml-1 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Select a search prompt to use for importing news. Each prompt contains its own set of keywords and search parameters.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
            </div>
            
            {isLoadingPrompts ? (
              <p className="text-sm text-muted-foreground">Loading prompts...</p>
            ) : prompts && prompts.length > 0 ? (
              <>
                <div className="flex flex-col space-y-4">
                  <Select
                    value={selectedPromptId}
                    onValueChange={(value) => {
                      setSelectedPromptId(value);
                    }}
                  >
                    <SelectTrigger className="w-full">
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
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleShowPreview}
                      disabled={!selectedPromptId}
                    >
                      <EyeIcon className="mr-2 h-4 w-4" />
                      Preview Prompt
                    </Button>
                    
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => setConfirmImportOpen(true)}
                      disabled={!selectedPromptId || isImporting}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Import className="mr-2 h-4 w-4" />
                          Import Now
                        </>
                      )}
                    </Button>
                    
                    <a href="/keyword-management?tab=maintenance" className="text-xs text-blue-500 hover:text-blue-700 flex items-center self-center">
                      <FileEdit className="h-4 w-4 mr-1" />
                      Manage Prompts
                    </a>
                  </div>
                </div>
                
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

          <Alert className="mt-2 bg-blue-50 text-blue-800 border border-blue-200">
            <Info className="h-4 w-4" />
            <AlertTitle>How Import Works</AlertTitle>
            <AlertDescription>
              News imports use the keywords and settings defined in the selected prompt. You can view these settings by clicking "Preview Prompt".
            </AlertDescription>
          </Alert>
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
      
      {/* Confirmation dialog */}
      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run news import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will run a manual news import using the "{getSelectedPrompt()?.function_name || 'selected'}" prompt.
              New articles will be added to Today's Briefing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportNow}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Run Import'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Prompt preview dialog */}
      {selectedPromptForPreview && (
        <NewsPromptPreviewDialog
          open={isPreviewDialogOpen}
          onOpenChange={setIsPreviewDialogOpen}
          prompt={selectedPromptForPreview}
          metadata={previewMetadata}
        />
      )}
    </Card>
  );
}
