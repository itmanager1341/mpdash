
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, Clock, Plus, Trash2, Save, Clipboard, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface KeywordPlan {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  associated_clusters?: string[];
  assigned_to?: string;
  created_at: string;
}

interface PlanningTabProps {
  searchTerm: string;
}

const PlanningTab = ({ searchTerm }: PlanningTabProps) => {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<Partial<KeywordPlan>>({
    title: "",
    description: "",
    priority: "medium",
    status: "planned",
    start_date: new Date().toISOString().split('T')[0],
  });
  
  // Fetch existing plans - Use type assertion to handle the new table
  const { data: plans, isLoading } = useQuery({
    queryKey: ['keyword-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_plans')
        .select('*')
        .order('start_date', { ascending: true });
      
      if (error) throw error;
      return data as unknown as KeywordPlan[];
    }
  });
  
  // Fetch clusters for the select dropdown
  const { data: clusters } = useQuery({
    queryKey: ['keyword-clusters-names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('id, primary_theme, sub_theme');
      
      if (error) throw error;
      return data;
    }
  });
  
  // Create new plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (planData: Partial<KeywordPlan>) => {
      const { data, error } = await supabase
        .from('keyword_plans')
        .insert([planData as any])
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-plans'] });
      toast.success("Keyword plan created successfully");
      setIsAddDialogOpen(false);
      setNewPlan({
        title: "",
        description: "",
        priority: "medium",
        status: "planned",
        start_date: new Date().toISOString().split('T')[0],
      });
    },
    onError: (error) => {
      toast.error(`Failed to create plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  
  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('keyword_plans')
        .delete()
        .eq('id', planId);
      
      if (error) throw error;
      return planId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-plans'] });
      toast.success("Plan deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  
  // Update plan status mutation
  const updatePlanStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { data, error } = await supabase
        .from('keyword_plans')
        .update({ status })
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-plans'] });
      toast.success("Plan status updated");
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  
  // Filter plans based on search term
  const filteredPlans = plans?.filter(plan => 
    !searchTerm || 
    plan.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (plan.description && plan.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Group plans by status
  const groupedPlans = filteredPlans?.reduce((acc, plan) => {
    if (!acc[plan.status]) {
      acc[plan.status] = [];
    }
    acc[plan.status].push(plan);
    return acc;
  }, {} as Record<string, KeywordPlan[]>) || {};
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500 border-red-500';
      case 'medium': return 'text-amber-500 border-amber-500';
      case 'low': return 'text-green-500 border-green-500';
      default: return 'text-muted-foreground border-border';
    }
  };

  const handleCreatePlan = () => {
    if (!newPlan.title) {
      toast.error("Please provide a title for the plan");
      return;
    }
    
    if (!newPlan.start_date) {
      toast.error("Please select a start date");
      return;
    }
    
    createPlanMutation.mutate(newPlan);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Keyword Planning</h2>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading plans...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Planned column */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3">
              <CardTitle className="flex items-center text-base">
                <Clipboard className="h-4 w-4 mr-2" />
                Planned
              </CardTitle>
              <CardDescription>{groupedPlans['planned']?.length || 0} plans</CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              {groupedPlans['planned']?.length ? (
                <div className="space-y-3">
                  {groupedPlans['planned'].map(plan => (
                    <Card key={plan.id} className="p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">{plan.title}</h3>
                        <Badge className={`${getPriorityColor(plan.priority)} bg-transparent`}>
                          {plan.priority}
                        </Badge>
                      </div>
                      
                      {plan.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{plan.description}</p>
                      )}
                      
                      <div className="text-xs text-muted-foreground flex items-center mt-2">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(plan.start_date).toLocaleDateString()}
                      </div>
                      
                      <div className="flex justify-between mt-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updatePlanStatusMutation.mutate({ id: plan.id, status: 'in-progress' })}
                        >
                          Start
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deletePlanMutation.mutate(plan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No planned items
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* In Progress column */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3">
              <CardTitle className="flex items-center text-base">
                <Clock className="h-4 w-4 mr-2" />
                In Progress
              </CardTitle>
              <CardDescription>{groupedPlans['in-progress']?.length || 0} plans</CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              {groupedPlans['in-progress']?.length ? (
                <div className="space-y-3">
                  {groupedPlans['in-progress'].map(plan => (
                    <Card key={plan.id} className="p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">{plan.title}</h3>
                        <Badge className={`${getPriorityColor(plan.priority)} bg-transparent`}>
                          {plan.priority}
                        </Badge>
                      </div>
                      
                      {plan.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{plan.description}</p>
                      )}
                      
                      <div className="text-xs text-muted-foreground flex items-center mt-2">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(plan.start_date).toLocaleDateString()}
                      </div>
                      
                      <div className="flex justify-between mt-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updatePlanStatusMutation.mutate({ id: plan.id, status: 'completed' })}
                        >
                          Complete
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => updatePlanStatusMutation.mutate({ id: plan.id, status: 'cancelled' })}
                          className="text-destructive hover:text-destructive"
                        >
                          Cancel
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No in-progress items
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Completed column */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3">
              <CardTitle className="flex items-center text-base">
                <Save className="h-4 w-4 mr-2" />
                Completed
              </CardTitle>
              <CardDescription>
                {(groupedPlans['completed']?.length || 0) + (groupedPlans['cancelled']?.length || 0)} plans
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              {(groupedPlans['completed']?.length || 0) + (groupedPlans['cancelled']?.length || 0) > 0 ? (
                <div className="space-y-3">
                  {groupedPlans['completed']?.map(plan => (
                    <Card key={plan.id} className="p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">{plan.title}</h3>
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500">
                          Completed
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground flex items-center mt-2">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(plan.start_date).toLocaleDateString()}
                      </div>
                      
                      <div className="flex justify-end mt-3">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deletePlanMutation.mutate(plan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  
                  {groupedPlans['cancelled']?.map(plan => (
                    <Card key={plan.id} className="p-3 shadow-sm opacity-70">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium line-through">{plan.title}</h3>
                        <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500">
                          Cancelled
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground flex items-center mt-2">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(plan.start_date).toLocaleDateString()}
                      </div>
                      
                      <div className="flex justify-end mt-3">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deletePlanMutation.mutate(plan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No completed or cancelled items
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Add Plan Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create New Keyword Plan</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plan Title</label>
              <Input 
                placeholder="Enter plan title" 
                value={newPlan.title || ''}
                onChange={e => setNewPlan({...newPlan, title: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                placeholder="Describe the plan..." 
                value={newPlan.description || ''}
                onChange={e => setNewPlan({...newPlan, description: e.target.value})}
                className="resize-none"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input 
                  type="date" 
                  value={newPlan.start_date || ''}
                  onChange={e => setNewPlan({...newPlan, start_date: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date (Optional)</label>
                <Input 
                  type="date" 
                  value={newPlan.end_date || ''}
                  onChange={e => setNewPlan({...newPlan, end_date: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select 
                  value={newPlan.priority || 'medium'} 
                  onValueChange={value => setNewPlan({...newPlan, priority: value as 'low' | 'medium' | 'high'})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select 
                  value={newPlan.status || 'planned'} 
                  onValueChange={value => setNewPlan({...newPlan, status: value as 'planned' | 'in-progress' | 'completed' | 'cancelled'})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Associated Clusters (Optional)</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select clusters" />
                </SelectTrigger>
                <SelectContent>
                  {clusters?.map(cluster => (
                    <SelectItem key={cluster.id} value={cluster.id}>
                      {cluster.primary_theme}: {cluster.sub_theme}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Note: Multi-select will be available in a future update</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePlan}>Create Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanningTab;
