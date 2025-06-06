
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit, Plus, Save, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ClusterForm from "./ClusterForm";
import { KeywordCluster } from "@/types/database";

interface ClusterTableViewProps {
  searchTerm: string;
}

const ClusterTableView = ({ searchTerm }: ClusterTableViewProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<KeywordCluster | null>(null);
  const [editingWeight, setEditingWeight] = useState<string | null>(null);
  const [tempWeight, setTempWeight] = useState<number>(50);
  const queryClient = useQueryClient();
  
  // Fetch clusters with article counts
  const { data: clusters, isLoading, error, refetch } = useQuery({
    queryKey: ['keyword-clusters-table'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('*')
        .order('primary_theme', { ascending: true })
        .order('sub_theme', { ascending: true });
      
      if (error) throw error;
      return data as KeywordCluster[];
    }
  });

  // Get article counts per cluster
  const { data: articleCounts } = useQuery({
    queryKey: ['cluster-article-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('article_ai_analysis')
        .select('matched_clusters');
      
      if (error) throw error;
      
      // Count occurrences of each cluster
      const counts: Record<string, number> = {};
      data.forEach(analysis => {
        if (analysis.matched_clusters && Array.isArray(analysis.matched_clusters)) {
          analysis.matched_clusters.forEach((cluster: string) => {
            counts[cluster] = (counts[cluster] || 0) + 1;
          });
        }
      });
      
      return counts;
    }
  });

  // Update priority weight mutation
  const updateWeightMutation = useMutation({
    mutationFn: async ({ id, weight }: { id: string; weight: number }) => {
      const { error } = await supabase
        .from('keyword_clusters')
        .update({ priority_weight: weight })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-clusters-table'] });
      toast.success("Weight percentage updated");
      setEditingWeight(null);
    },
    onError: (error) => {
      toast.error(`Failed to update weight: ${error.message}`);
    }
  });

  // Normalize weights mutation
  const normalizeWeightsMutation = useMutation({
    mutationFn: async () => {
      if (!clusters) return;
      
      const totalWeight = clusters.reduce((sum, cluster) => sum + (cluster.priority_weight || 0), 0);
      if (totalWeight === 0) return;
      
      const updates = clusters.map(cluster => ({
        id: cluster.id,
        priority_weight: Math.round(((cluster.priority_weight || 0) / totalWeight) * 100)
      }));
      
      for (const update of updates) {
        const { error } = await supabase
          .from('keyword_clusters')
          .update({ priority_weight: update.priority_weight })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-clusters-table'] });
      toast.success("Weights normalized to 100%");
    },
    onError: (error) => {
      toast.error(`Failed to normalize weights: ${error.message}`);
    }
  });

  // Filter clusters based on search term
  const filteredClusters = clusters?.filter(cluster => 
    !searchTerm || 
    cluster.primary_theme.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cluster.sub_theme.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cluster.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cluster.keywords?.some(keyword => 
      keyword.toLowerCase().includes(searchTerm.toLowerCase())
    ) ||
    cluster.professions?.some(profession => 
      profession.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  // Calculate total weight percentage
  const totalWeight = filteredClusters.reduce((sum, cluster) => sum + (cluster.priority_weight || 0), 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.1; // Allow for small rounding differences

  const handleEditWeight = (clusterId: string, currentWeight: number) => {
    setEditingWeight(clusterId);
    setTempWeight(currentWeight || 0);
  };

  const handleSaveWeight = (clusterId: string) => {
    updateWeightMutation.mutate({ id: clusterId, weight: tempWeight });
  };

  const handleCancelWeight = () => {
    setEditingWeight(null);
    setTempWeight(0);
  };

  const handleEditCluster = (cluster: KeywordCluster) => {
    setSelectedCluster(cluster);
    setIsAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setSelectedCluster(null);
  };

  const handleSaveSuccess = () => {
    handleDialogClose();
    refetch();
    toast.success(selectedCluster ? "Cluster updated" : "New cluster created");
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading clusters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive p-4 rounded-md">
        <p>Error loading keyword clusters. Please try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">Keyword Clusters</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your content taxonomy with hierarchical keyword clusters and percentage weights
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Cluster
        </Button>
      </div>

      {/* Weight Status Alert */}
      {filteredClusters.length > 0 && (
        <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="font-medium">Total Weight:</span>
            <Badge variant={isWeightValid ? "success" : "warning"} className="text-sm">
              {totalWeight.toFixed(1)}%
            </Badge>
            {!isWeightValid && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Weights should total 100%</span>
              </div>
            )}
          </div>
          {!isWeightValid && totalWeight > 0 && (
            <Button 
              onClick={() => normalizeWeightsMutation.mutate()}
              disabled={normalizeWeightsMutation.isPending}
              variant="outline"
              size="sm"
            >
              Normalize to 100%
            </Button>
          )}
        </div>
      )}

      {filteredClusters.length === 0 ? (
        <div className="bg-muted/50 rounded-md p-8 text-center">
          <h3 className="font-semibold mb-2">No clusters found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? "No clusters match your search" : "Create your first cluster to get started"}
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cluster
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Primary Theme</TableHead>
                <TableHead>Sub-theme</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Professions</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Weight %</TableHead>
                <TableHead>Article Count</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClusters.map((cluster) => (
                <TableRow key={cluster.id}>
                  <TableCell className="font-medium">
                    {cluster.primary_theme}
                  </TableCell>
                  <TableCell>{cluster.sub_theme}</TableCell>
                  <TableCell className="max-w-xs">
                    {cluster.description ? (
                      <div className="truncate" title={cluster.description}>
                        {cluster.description}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">No description</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {cluster.professions?.slice(0, 3).map((profession, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {profession}
                        </Badge>
                      ))}
                      {(cluster.professions?.length || 0) > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{(cluster.professions?.length || 0) - 3} more
                        </Badge>
                      )}
                      {(!cluster.professions || cluster.professions.length === 0) && (
                        <span className="text-muted-foreground italic text-xs">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {cluster.keywords?.slice(0, 5).map((keyword, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                      {(cluster.keywords?.length || 0) > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{(cluster.keywords?.length || 0) - 5} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingWeight === cluster.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={tempWeight}
                          onChange={(e) => setTempWeight(Number(e.target.value))}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                        <Button
                          size="sm"
                          onClick={() => handleSaveWeight(cluster.id)}
                          disabled={updateWeightMutation.isPending}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelWeight}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline"
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleEditWeight(cluster.id, cluster.priority_weight || 0)}
                        >
                          {(cluster.priority_weight || 0).toFixed(1)}%
                        </Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {articleCounts?.[cluster.sub_theme] || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEditCluster(cluster)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedCluster ? "Edit Cluster" : "Add New Cluster"}</DialogTitle>
            <DialogDescription>
              {selectedCluster 
                ? "Update this keyword cluster's details and keywords" 
                : "Create a new keyword cluster to organize your content taxonomy"}
            </DialogDescription>
          </DialogHeader>
          
          <ClusterForm 
            cluster={selectedCluster} 
            onCancel={handleDialogClose} 
            onSuccess={handleSaveSuccess} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClusterTableView;
