
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Search, Calendar, Play, Clock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromptsList from "@/components/llm/PromptsList";
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
  const [activeView, setActiveView] = useState("prompts");
  
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

  const handleAddNew = () => {
    setEditingPrompt(null);
    setIsAddingPrompt(true);
  };
  
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
    // TODO: Implement scheduling logic
    toast.info("Scheduling feature coming soon");
  };

  const handleRunNow = async (promptId: string) => {
    try {
      const { error } = await supabase.functions.invoke('test-llm-prompt', {
        body: { 
          prompt_id: promptId,
          input_data: { query: "latest mortgage industry news" }
        }
      });
      
      if (error) throw error;
      toast.success("Search prompt executed successfully");
    } catch (error) {
      console.error("Error running prompt:", error);
      toast.error("Failed to execute search prompt");
    }
  };
  
  const filteredPrompts = allPrompts?.filter(prompt => 
    prompt.function_name.toLowerCase().includes(promptSearchTerm.toLowerCase()) ||
    prompt.function_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    console.error("Error fetching search prompts:", error);
    toast.error("Failed to load search prompts. Please try refreshing the page.");
  }

  const getSearchStats = () => {
    if (!allPrompts) return { active: 0, scheduled: 0, onDemand: 0 };
    
    const active = allPrompts.filter(p => p.is_active).length;
    const scheduled = scheduledTasks?.filter(t => t.is_enabled).length || 0;
    const onDemand = active - scheduled;
    
    return { active, scheduled, onDemand };
  };

  const stats = getSearchStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">News Search Prompts</h2>
            <p className="text-muted-foreground">
              Create, schedule, and manage AI prompts for automated news discovery and on-demand content research
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Search Prompt
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Prompts</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
                <Badge className="bg-green-100 text-green-800">Live</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold">{stats.scheduled}</p>
                </div>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">On-Demand</p>
                  <p className="text-2xl font-bold">{stats.onDemand}</p>
                </div>
                <Play className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab View */}
        <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prompts">Search Prompts</TabsTrigger>
            <TabsTrigger value="schedules">Scheduled Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="prompts" className="space-y-4">
            {/* Search Bar */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search search prompts..."
                value={promptSearchTerm}
                onChange={(e) => setPromptSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Information Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-base">About Search Prompts</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  Search prompts use real-time search capabilities to discover and analyze news content. 
                  They can be scheduled for regular monitoring or executed on-demand for specific research needs.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">Perplexity Models Recommended</Badge>
                  <Badge variant="outline" className="text-xs">Real-time Search</Badge>
                  <Badge variant="outline" className="text-xs">Cluster-Weighted</Badge>
                </div>
              </CardContent>
            </Card>
            
            {/* Enhanced Prompts List with Actions */}
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
                  {filteredPrompts?.map((prompt) => (
                    <Card key={prompt.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{prompt.function_name}</CardTitle>
                              <Badge variant={prompt.is_active ? "default" : "secondary"}>
                                {prompt.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                Search
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Model: {prompt.model}</span>
                              <span>Updated: {new Date(prompt.updated_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSchedulePrompt(prompt.id)}
                            >
                              <Clock className="mr-2 h-3 w-3" />
                              Schedule
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRunNow(prompt.id)}
                            >
                              <Play className="mr-2 h-3 w-3" />
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
                        <CardDescription className="text-sm text-muted-foreground line-clamp-3">
                          {prompt.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '')}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="schedules" className="space-y-4">
            <div className="grid gap-4">
              {scheduledTasks?.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Scheduled Tasks</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Schedule search prompts to run automatically for regular news monitoring.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                scheduledTasks?.map((task) => (
                  <Card key={task.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-base">{task.job_name}</CardTitle>
                        <CardDescription>Schedule: {task.schedule}</CardDescription>
                      </div>
                      <Badge variant={task.is_enabled ? "default" : "secondary"}>
                        {task.is_enabled ? "Active" : "Paused"}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Last run: {task.last_run ? new Date(task.last_run).toLocaleString() : 'Never'}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Settings className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
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
