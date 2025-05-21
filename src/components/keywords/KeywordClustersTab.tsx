
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Plus, PieChart } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import ClusterForm from "./ClusterForm";

interface KeywordCluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  description?: string;
  keywords?: string[];
  professions?: string[];
  created_at: string;
}

interface KeywordClustersTabProps {
  searchTerm: string;
}

const KeywordClustersTab = ({ searchTerm }: KeywordClustersTabProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<KeywordCluster | null>(null);
  
  // Fetch all keyword clusters
  const { data: clusters, isLoading, error, refetch } = useQuery({
    queryKey: ['keyword-clusters'],
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

  // Filter clusters based on search term
  const filteredClusters = clusters?.filter(cluster => 
    !searchTerm || 
    cluster.primary_theme.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cluster.sub_theme.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cluster.keywords?.some(keyword => 
      keyword.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Group clusters by primary theme
  const groupedClusters = filteredClusters?.reduce((acc, cluster) => {
    if (!acc[cluster.primary_theme]) {
      acc[cluster.primary_theme] = [];
    }
    acc[cluster.primary_theme].push(cluster);
    return acc;
  }, {} as Record<string, KeywordCluster[]>) || {};

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Keyword Clusters</h2>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Cluster
        </Button>
      </div>
      
      {isLoading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading clusters...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <p>Error loading keyword clusters. Please try refreshing.</p>
        </div>
      )}

      {Object.entries(groupedClusters).length === 0 && !isLoading && !error && (
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
      )}

      {Object.entries(groupedClusters).map(([primaryTheme, themeClusters]) => (
        <Card key={primaryTheme} className="overflow-hidden">
          <CardHeader className="bg-muted/30 pb-2">
            <CardTitle>{primaryTheme}</CardTitle>
            <CardDescription>{themeClusters.length} sub-themes</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {themeClusters.map((cluster) => (
              <div key={cluster.id} className="py-4 first:pt-3 last:pb-2">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium">{cluster.sub_theme}</h3>
                  <Button variant="ghost" size="sm" onClick={() => handleEditCluster(cluster)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                
                {cluster.description && (
                  <p className="text-sm text-muted-foreground mb-3">{cluster.description}</p>
                )}
                
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {cluster.keywords?.slice(0, 8).map((keyword, idx) => (
                    <Badge key={idx} variant="outline" className="bg-primary/5">
                      {keyword}
                    </Badge>
                  ))}
                  {(cluster.keywords?.length || 0) > 8 && (
                    <Badge variant="outline">+{(cluster.keywords?.length || 0) - 8} more</Badge>
                  )}
                </div>
                
                {cluster.professions && cluster.professions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Relevant professions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.professions.map((profession, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {profession}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

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

export default KeywordClustersTab;
