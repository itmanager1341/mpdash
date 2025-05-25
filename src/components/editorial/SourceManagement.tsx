import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  ExternalLink,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2
} from "lucide-react";

interface Source {
  id: string;
  source_name: string;
  source_url: string;
  priority_tier: number;
  source_type: string;
  cluster_alignment: string[] | null;
  created_at: string;
}

export default function SourceManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [newSource, setNewSource] = useState({
    source_name: "",
    source_url: "",
    priority_tier: 3,
    source_type: "source",
    cluster_alignment: null as string[] | null
  });

  const queryClient = useQueryClient();

  // Fetch sources with all fields including source_type and cluster_alignment
  const { data: sources, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      console.log('Fetching sources...');
      const { data, error } = await supabase
        .from('sources')
        .select('id, source_name, source_url, priority_tier, source_type, cluster_alignment, created_at')
        .order('priority_tier');
        
      if (error) {
        console.error('Error fetching sources:', error);
        throw error;
      }
      
      console.log('Fetched sources:', data);
      return data || [];
    }
  });

  // Fetch keyword clusters for the cluster alignment dropdown
  const { data: clusters } = useQuery({
    queryKey: ['keyword-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('id, primary_theme, sub_theme')
        .order('primary_theme');
        
      if (error) throw error;
      return data || [];
    }
  });

  // Add/Update source mutation
  const saveSourceMutation = useMutation({
    mutationFn: async (sourceData: any) => {
      console.log('Saving source data:', sourceData);
      if (editingSource) {
        const { error } = await supabase
          .from('sources')
          .update(sourceData)
          .eq('id', editingSource.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sources')
          .insert(sourceData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast.success(editingSource ? 'Source updated' : 'Source added');
      setShowAddForm(false);
      setEditingSource(null);
      setNewSource({
        source_name: "",
        source_url: "",
        priority_tier: 3,
        source_type: "source",
        cluster_alignment: null
      });
    },
    onError: (error) => {
      console.error('Error saving source:', error);
      toast.error('Failed to save source: ' + error.message);
    }
  });

  // Delete source mutation
  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sources')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast.success('Source deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete source: ' + error.message);
    }
  });

  const filteredSources = sources?.filter(source => 
    source.source_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.source_url.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleEdit = (source: Source) => {
    console.log('Editing source with source_type:', source.source_type);
    setEditingSource(source);
    setNewSource({
      source_name: source.source_name,
      source_url: source.source_url,
      priority_tier: source.priority_tier,
      source_type: source.source_type || "source",
      cluster_alignment: source.cluster_alignment
    });
    setShowAddForm(true);
  };

  const handleSave = () => {
    if (!newSource.source_name.trim() || !newSource.source_url.trim()) {
      toast.error('Please provide both name and URL');
      return;
    }

    console.log('Saving source with source_type:', newSource.source_type);
    saveSourceMutation.mutate(newSource);
  };

  const getRelationshipBadge = (type: string) => {
    // Handle null, undefined, or empty string
    if (!type) {
      return <Badge variant="default">Source</Badge>;
    }
    
    // Convert to lowercase for comparison
    const normalizedType = type.toLowerCase().trim();
    
    // Map actual database values to appropriate badges
    if (normalizedType.includes('government') || normalizedType.includes('agency') || normalizedType.includes('committee')) {
      return <Badge variant="outline" className="border-blue-500 text-blue-700">Government</Badge>;
    }
    if (normalizedType.includes('gse')) {
      return <Badge variant="outline" className="border-green-500 text-green-700">GSE</Badge>;
    }
    if (normalizedType.includes('media')) {
      return <Badge variant="outline" className="border-purple-500 text-purple-700">Media</Badge>;
    }
    if (normalizedType.includes('competitor')) {
      return <Badge variant="destructive">Competitor</Badge>;
    }
    if (normalizedType.includes('partner')) {
      return <Badge variant="secondary">Partner</Badge>;
    }
    if (normalizedType.includes('think tank')) {
      return <Badge variant="outline" className="border-orange-500 text-orange-700">Think Tank</Badge>;
    }
    if (normalizedType.includes('trade association') || normalizedType.includes('economic organization')) {
      return <Badge variant="outline" className="border-teal-500 text-teal-700">Association</Badge>;
    }
    if (normalizedType.includes('legislator')) {
      return <Badge variant="outline" className="border-indigo-500 text-indigo-700">Legislator</Badge>;
    }
    if (normalizedType.includes('press release') || normalizedType.includes('service')) {
      return <Badge variant="outline" className="border-gray-500 text-gray-700">Press Service</Badge>;
    }
    if (normalizedType.includes('data provider') || normalizedType.includes('platform')) {
      return <Badge variant="outline" className="border-cyan-500 text-cyan-700">Data/Platform</Badge>;
    }
    
    // Default fallback - show the actual type from database
    return <Badge variant="default">{type}</Badge>;
  };

  const getPriorityIcon = (tier: number) => {
    if (tier === 1) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (tier === 2) return <CheckCircle className="h-4 w-4 text-blue-500" />;
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  };

  const sourcesByTier = filteredSources.reduce((acc, source) => {
    const tier = source.priority_tier;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(source);
    return acc;
  }, {} as Record<number, Source[]>);

  // Get all unique source types from the database for the dropdown
  const sourceTypeOptions = [
    "source",
    "competitor", 
    "partner",
    "government",
    "Government Agency",
    "Government Committee", 
    "GSE",
    "Media",
    "Think Tank",
    "Trade Association",
    "Economic Organization",
    "Legislator",
    "Press Release Service",
    "Data Provider",
    "Real Estate Platform"
  ];

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="mr-2 h-4 w-4" />
          Add Source
        </Button>
      </div>

      {/* Add/Edit Source Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingSource ? 'Edit Source' : 'Add New Source'}</CardTitle>
            <CardDescription>
              Configure news sources with priority tiers and relationship types
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source-name">Source Name</Label>
                <Input
                  id="source-name"
                  value={newSource.source_name}
                  onChange={(e) => setNewSource({ ...newSource, source_name: e.target.value })}
                  placeholder="e.g., Federal Reserve"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-url">URL</Label>
                <Input
                  id="source-url"
                  value={newSource.source_url}
                  onChange={(e) => setNewSource({ ...newSource, source_url: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority-tier">Priority Tier</Label>
                <Select 
                  value={newSource.priority_tier.toString()} 
                  onValueChange={(value) => setNewSource({ ...newSource, priority_tier: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tier 1 - Critical</SelectItem>
                    <SelectItem value="2">Tier 2 - Important</SelectItem>
                    <SelectItem value="3">Tier 3 - Standard</SelectItem>
                    <SelectItem value="4">Tier 4 - Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source-type">Source Type</Label>
                <Select 
                  value={newSource.source_type} 
                  onValueChange={(value) => {
                    setNewSource({ ...newSource, source_type: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTypeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => {
                setShowAddForm(false);
                setEditingSource(null);
                setNewSource({
                  source_name: "",
                  source_url: "",
                  priority_tier: 3,
                  source_type: "source",
                  cluster_alignment: null
                });
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saveSourceMutation.isPending}>
                {saveSourceMutation.isPending ? 'Saving...' : (editingSource ? 'Update' : 'Add Source')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sources by Priority Tier */}
      {Object.entries(sourcesByTier)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([tier, tierSources]) => (
          <Card key={tier}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getPriorityIcon(parseInt(tier))}
                Tier {tier} Sources
                <Badge variant="outline">{tierSources.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tierSources.map((source) => {
                  console.log('Rendering source card for:', source.source_name, 'with source_type:', source.source_type);
                  return (
                    <div key={source.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{source.source_name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ExternalLink className="h-3 w-3" />
                            <a 
                              href={source.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline truncate max-w-[200px]"
                            >
                              {new URL(source.source_url).hostname}
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getRelationshipBadge(source.source_type)}
                        </div>
                        
                        {/* Display cluster alignment if present */}
                        {source.cluster_alignment && source.cluster_alignment.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Cluster Alignment:</p>
                            <div className="flex flex-wrap gap-1">
                              {source.cluster_alignment.map((clusterId, index) => {
                                const cluster = clusters?.find(c => c.id === clusterId);
                                return (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {cluster ? cluster.primary_theme : clusterId}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEdit(source)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deleteSourceMutation.mutate(source.id)}
                          disabled={deleteSourceMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

      {filteredSources.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No sources found. Add your first source to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
