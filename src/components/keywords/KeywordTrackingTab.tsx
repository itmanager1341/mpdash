
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead,  
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ChevronDown, 
  Edit, 
  PlusCircle, 
  MoreVertical, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ChevronRight
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface KeywordTracking {
  id: string;
  keyword: string;
  category?: string;
  priority?: string;
  status?: string;
  article_count?: number;
  last_searched_date?: string;
  created_at: string;
}

interface KeywordTrackingTabProps {
  searchTerm: string;
}

const KeywordTrackingTab = ({ searchTerm }: KeywordTrackingTabProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  
  const queryClient = useQueryClient();

  // Fetch all tracked keywords
  const { data: trackedKeywords, isLoading, error } = useQuery({
    queryKey: ['keyword-tracking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_tracking')
        .select('*')
        .order('priority', { ascending: false })
        .order('keyword', { ascending: true });
      
      if (error) throw error;
      return data as KeywordTracking[];
    }
  });

  // Add new keyword tracking
  const addKeyword = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('keyword_tracking')
        .insert({
          keyword: newKeyword,
          category: newCategory || null,
          priority: newPriority,
          status: 'active'
        });
        
      if (error) throw error;
    },
    onSuccess: () => {
      setIsAddDialogOpen(false);
      setNewKeyword("");
      setNewCategory("");
      setNewPriority("medium");
      queryClient.invalidateQueries({ queryKey: ['keyword-tracking'] });
      toast.success("Keyword added to tracking");
    },
    onError: (error) => {
      toast.error(`Failed to add keyword: ${error.message}`);
    }
  });

  // Update keyword status
  const updateKeywordStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from('keyword_tracking')
        .update({ status })
        .eq('id', id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-tracking'] });
      toast.success("Keyword status updated");
    },
    onError: (error) => {
      toast.error(`Failed to update keyword: ${error.message}`);
    }
  });

  // Filter keywords based on search term and filters
  const filteredKeywords = trackedKeywords?.filter(keyword => {
    const matchesSearch = !searchTerm || 
      keyword.keyword.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (keyword.category && keyword.category.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || keyword.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || keyword.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalFiltered = filteredKeywords?.length || 0;
  const totalArticles = filteredKeywords?.reduce((sum, k) => sum + (k.article_count || 0), 0) || 0;

  // Returns a CSS class for priority badges
  const getPriorityStyles = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword) {
      toast.error("Keyword cannot be empty");
      return;
    }
    addKeyword.mutate();
  };

  const getPriorityIcon = (count?: number, created_at?: string) => {
    if (count === undefined) return null;
    
    // If article count is 0 but keyword was added recently (last 7 days)
    if (count === 0 && created_at) {
      const createdDate = new Date(created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      if (createdDate > sevenDaysAgo) {
        return <Badge variant="outline" className="text-xs">New</Badge>;
      }
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
    
    if (count > 10) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (count < 2) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Keyword Tracking</h2>
          <p className="text-sm text-muted-foreground">
            {totalFiltered} keywords | {totalArticles} articles
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Keyword
        </Button>
      </div>
      
      <div className="flex gap-4">
        <div className="w-40">
          <Label htmlFor="status-filter" className="text-xs">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger id="status-filter" className="h-8 mt-1">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-40">
          <Label htmlFor="priority-filter" className="text-xs">Priority</Label>
          <Select
            value={priorityFilter}
            onValueChange={setPriorityFilter}
          >
            <SelectTrigger id="priority-filter" className="h-8 mt-1">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {isLoading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading keywords...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <p>Error loading keyword tracking data. Please try refreshing.</p>
        </div>
      )}

      {filteredKeywords && filteredKeywords.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Articles</TableHead>
                <TableHead className="text-right">Last Search</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeywords.map((keyword) => (
                <TableRow key={keyword.id}>
                  <TableCell className="flex items-center gap-2 font-medium">
                    {keyword.status === "paused" ? (
                      <span className="text-muted-foreground">{keyword.keyword}</span>
                    ) : (
                      keyword.keyword
                    )}
                    {keyword.status === "paused" && (
                      <Badge variant="outline" className="text-xs">Paused</Badge>
                    )}
                  </TableCell>
                  <TableCell>{keyword.category || "-"}</TableCell>
                  <TableCell>
                    <Badge className={getPriorityStyles(keyword.priority)} variant="outline">
                      {keyword.priority || "medium"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    {getPriorityIcon(keyword.article_count, keyword.created_at)}
                    {keyword.article_count || 0}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {keyword.last_searched_date ? (
                      new Date(keyword.last_searched_date).toLocaleDateString()
                    ) : (
                      "Never"
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" /> Edit Keyword
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {keyword.status === "active" ? (
                          <DropdownMenuItem onClick={() => updateKeywordStatus.mutate({ 
                            id: keyword.id, 
                            status: "paused" 
                          })}>
                            Pause Tracking
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateKeywordStatus.mutate({ 
                            id: keyword.id, 
                            status: "active" 
                          })}>
                            Resume Tracking
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => updateKeywordStatus.mutate({ 
                            id: keyword.id, 
                            status: "archived" 
                          })}
                          className="text-destructive focus:text-destructive"
                        >
                          Archive Keyword
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        !isLoading && (
          <div className="bg-muted/50 rounded-md p-8 text-center">
            <h3 className="font-semibold mb-2">No keywords found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all" || priorityFilter !== "all" 
                ? "No keywords match your current filters" 
                : "Add keywords to start tracking their performance"}
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Keyword
            </Button>
          </div>
        )
      )}
      
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Keyword to Tracking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddKeyword}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="keyword">Keyword</Label>
                <Input
                  id="keyword"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Enter keyword to track"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category (Optional)</Label>
                <Input
                  id="category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g., Market Trends"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newPriority}
                  onValueChange={(value) => setNewPriority(value)}
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!newKeyword || addKeyword.isPending}
              >
                {addKeyword.isPending ? "Adding..." : "Add Keyword"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KeywordTrackingTab;
