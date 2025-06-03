
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Play, Clock, Settings, Loader2, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import VisualPromptBuilder from "@/components/keywords/VisualPromptBuilder";
import { fetchPrompts } from "@/utils/llmPromptsUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SearchPromptsTabProps {
  searchTerm: string;
}

export default function SearchPromptsTab({ searchTerm }: SearchPromptsTabProps) {
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<LlmPrompt | null>(null);
  const [promptSearchTerm, setPromptSearchTerm] = useState("");
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());
  
  const { data: allPrompts, isLoading, error, refetch } = useQuery({
    queryKey: ['news-search-prompts'],
    queryFn: async () => {
      const allPrompts = await fetchPrompts();
      // Filter to only news search prompts
      return allPrompts.filter(prompt => 
        prompt.prompt_text.includes('search_settings') || 
        prompt.prompt_text.includes('domain_filter') ||
        prompt.prompt_text.includes('recency_filter') ||
        prompt.function_name.toLowerCase().includes('news') ||
        prompt.function_name.toLowerCase().includes('search') ||
        prompt.function_name.toLowerCase().includes('fetch')
      );
    }
  });

  // Fetch scheduled tasks for news search
  const { data: scheduledTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['news-search-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_job_settings')
        .select('*')
        .ilike('job_name', '%news%');
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleEdit = (prompt: LlmPrompt) => {
    setEditingPrompt(prompt);
    setIsAddingPrompt(true);
  };
  
  const handleFormClose = () => {
    setIsAddingPrompt(false);
    setEditingPrompt(null);
  };
  
  const handleSuccess = () => {
    refetch();
    handleFormClose();
    toast.success(editingPrompt ? "Search prompt updated successfully" : "Search prompt created successfully");
  };

  const handleSchedulePrompt = async (promptId: string) => {
    try {
      const prompt = allPrompts?.find(p => p.id === promptId);
      if (!prompt) {
        toast.error("Prompt not found");
        return;
      }

      // Create a scheduled job for this prompt
      const { error } = await supabase
        .from('scheduled_job_settings')
        .insert({
          job_name: `news_search_${prompt.function_name.toLowerCase().replace(/\s+/g, '_')}`,
          schedule: '0 */6 * * *', // Every 6 hours by default
          is_enabled: true,
          parameters: {
            promptId: promptId,
            minScore: 0.6,
            limit: 10
          }
        });

      if (error) throw error;

      toast.success("Prompt scheduled successfully");
      refetchTasks();
    } catch (error) {
      console.error("Error scheduling prompt:", error);
      toast.error("Failed to schedule prompt");
    }
  };

  const handleRunNow = async (promptId: string) => {
    if (runningPrompts.has(promptId)) return;
    
    setRunningPrompts(prev => new Set(prev).add(promptId));
    
    try {
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { 
          manual: true,
          promptId: promptId
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`News search completed: ${data.details.articles_inserted} articles imported`);
      } else {
        toast.warning(data?.message || "Search completed but no new articles found");
      }
    } catch (error) {
      console.error("Error running prompt:", error);
      toast.error("Failed to execute search prompt");
    } finally {
      setRunningPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
    }
  };

  const toggleScheduledTask = async (taskId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('scheduled_job_settings')
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      
      if (error) throw error;
      
      toast.success(`Schedule ${enabled ? 'enabled' : 'disabled'} successfully`);
      refetchTasks();
    } catch (error) {
      console.error('Error toggling schedule:', error);
      toast.error('Failed to toggle schedule');
    }
  };

  // Helper function to get schedule info for a prompt
  const getPromptSchedule = (promptId: string) => {
    return scheduledTasks?.find(task => 
      task.parameters?.promptId === promptId ||
      task.job_name.includes(allPrompts?.find(p => p.id === promptId)?.function_name.toLowerCase().replace(/\s+/g, '_') || '')
    );
  };
  
  const filteredPrompts = allPrompts?.filter(prompt => 
    prompt.function_name.toLowerCase().includes(promptSearchTerm.toLowerCase()) ||
    prompt.function_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    console.error("Error fetching search prompts:", error);
    toast.error("Failed to load search prompts. Please try refreshing the page.");
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">News Search Prompts</h2>
          <p className="text-muted-foreground">
            Create, schedule, and manage AI prompts for automated news discovery
          </p>
        </div>
        <Button onClick={() => setIsAddingPrompt(true)}>
          <Settings className="mr-2 h-4 w-4" />
          New Search Prompt
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search prompts..."
          value={promptSearchTerm}
          onChange={(e) => setPromptSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Prompts List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading search prompts...
          </div>
        ) : filteredPrompts?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No search prompts found. Add a new search prompt to get started.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPrompts?.map((prompt) => {
              const schedule = getPromptSchedule(prompt.id);
              return (
                <Card key={prompt.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{prompt.function_name}</CardTitle>
                          <Badge variant={prompt.is_active ? "default" : "secondary"}>
                            {prompt.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {schedule && (
                            <Badge variant={schedule.is_enabled ? "success" : "outline"}>
                              {schedule.is_enabled ? "Scheduled" : "Paused"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Model: {prompt.model}</span>
                          {schedule && (
                            <span>Schedule: {schedule.schedule}</span>
                          )}
                          <span>Updated: {new Date(prompt.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {schedule ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleScheduledTask(schedule.id, !schedule.is_enabled)}
                          >
                            {schedule.is_enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSchedulePrompt(prompt.id)}
                          >
                            <Clock className="mr-2 h-3 w-3" />
                            Schedule
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRunNow(prompt.id)}
                          disabled={runningPrompts.has(prompt.id)}
                        >
                          {runningPrompts.has(prompt.id) ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="mr-2 h-3 w-3" />
                          )}
                          Run Now
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(prompt)}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <CardDescription className="text-sm text-muted-foreground">
                      {schedule?.last_run && (
                        <span>Last run: {new Date(schedule.last_run).toLocaleString()}</span>
                      )}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      
      {isAddingPrompt && (
        <VisualPromptBuilder
          initialPrompt={editingPrompt}
          onSave={handleSuccess}
          onCancel={handleFormClose}
          initialActiveTab="search"
        />
      )}
    </div>
  );
}
