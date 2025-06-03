
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Settings, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClusterMaintenanceTabProps {
  searchTerm: string;
}

export default function ClusterMaintenanceTab({ searchTerm }: ClusterMaintenanceTabProps) {
  const [activeView, setActiveView] = useState("clusters");
  const [localSearchTerm, setLocalSearchTerm] = useState("");

  // Fetch keyword clusters
  const { data: clusters, isLoading: clustersLoading } = useQuery({
    queryKey: ['keyword-clusters-maintenance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('*')
        .order('primary_theme');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch tracking data for performance insights
  const { data: trackingData } = useQuery({
    queryKey: ['keyword-tracking-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    }
  });

  const filteredClusters = clusters?.filter(cluster =>
    cluster.primary_theme.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cluster.primary_theme.toLowerCase().includes(localSearchTerm.toLowerCase()) ||
    cluster.sub_theme?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cluster.sub_theme?.toLowerCase().includes(localSearchTerm.toLowerCase())
  );

  // Calculate cluster health metrics based on general keyword tracking activity
  const getClusterHealth = (cluster: any) => {
    // Since keyword_tracking doesn't have cluster_id, we'll use a simple heuristic
    // based on whether the cluster has keywords and if any tracking data exists
    const hasKeywords = cluster.keywords && cluster.keywords.length > 0;
    const trackingCount = trackingData?.length || 0;
    
    if (!hasKeywords || trackingCount === 0) return 'inactive';
    if (trackingCount < 5) return 'low';
    if (trackingCount < 15) return 'medium';
    return 'high';
  };

  const getHealthBadgeVariant = (health: string) => {
    switch (health) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'destructive';
      default: return 'secondary';
    }
  };

  if (clustersLoading) {
    return <div>Loading cluster maintenance data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cluster Maintenance</h2>
          <p className="text-muted-foreground">Monitor and maintain keyword cluster health and performance</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clusters..."
          value={localSearchTerm}
          onChange={(e) => setLocalSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="clusters">Cluster Health</TabsTrigger>
          <TabsTrigger value="performance">Performance Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="clusters" className="space-y-4">
          <div className="grid gap-4">
            {filteredClusters?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Clusters Found</h3>
                  <p className="text-muted-foreground text-center">
                    Create keyword clusters to monitor their health and performance.
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredClusters?.map((cluster) => {
                const health = getClusterHealth(cluster);
                const keywordCount = cluster.keywords?.length || 0;
                
                return (
                  <Card key={cluster.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-base">{cluster.primary_theme}</CardTitle>
                        <CardDescription>
                          {cluster.sub_theme} • Weight: {cluster.priority_weight || 50}%
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getHealthBadgeVariant(health)}>
                          {health} activity
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {keywordCount} keywords
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {cluster.professions?.length || 0} professions
                          </span>
                        </div>
                        {health === 'inactive' && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            Needs attention
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Insights</CardTitle>
              <CardDescription>
                Cluster performance metrics and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{clusters?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Clusters</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">
                      {clusters?.filter(c => getClusterHealth(c) === 'high').length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">High Activity</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">
                      {clusters?.filter(c => getClusterHealth(c) === 'inactive').length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Needs Attention</div>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Performance insights and recommendations will be displayed here based on cluster activity and tracking data.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
