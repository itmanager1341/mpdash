
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
  name: string;
  url: string;
  priority_tier: number;
  relationship_type: string;
  domain_authority: number | null;
  is_active: boolean;
  created_at: string;
}

export default function SourceManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [newSource, setNewSource] = useState({
    name: "",
    url: "",
    priority_tier: 3,
    relationship_type: "source",
    domain_authority: null,
    is_active: true
  });

  const queryClient = useQueryClient();

  // Fetch sources
  const { data: sources, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .order('priority_tier');
        
      if (error) throw error;
      return data || [];
    }
  });

  // Add/Update source mutation
  const saveSourceMutation = useMutation({
    mutationFn: async (sourceData: any) => {
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
        name: "",
        url: "",
        priority_tier: 3,
        relationship_type: "source",
        domain_authority: null,
        is_active: true
      });
    },
    onError: (error) => {
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

  // Toggle source active status
  const toggleSourceMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string, is_active: boolean }) => {
      const { error } = await supabase
        .from('sources')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
    onError: (error) => {
      toast.error('Failed to update source: ' + error.message);
    }
  });

  const filteredSources = sources?.filter(source => 
    source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.url.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleEdit = (source: Source) => {
    setEditingSource(source);
    setNewSource({
      name: source.name,
      url: source.url,
      priority_tier: source.priority_tier,
      relationship_type: source.relationship_type,
      domain_authority: source.domain_authority,
      is_active: source.is_active
    });
    setShowAddForm(true);
  };

  const handleSave = () => {
    if (!newSource.name.trim() || !newSource.url.trim()) {
      toast.error('Please provide both name and URL');
      return;
    }

    saveSourceMutation.mutate(newSource);
  };

  const getRelationshipBadge = (type: string) => {
    switch (type) {
      case 'competitor':
        return <Badge variant="destructive">Competitor</Badge>;
      case 'partner':
        return <Badge variant="secondary">Partner</Badge>;
      case 'government':
        return <Badge variant="outline" className="border-blue-500 text-blue-700">Government</Badge>;
      default:
        return <Badge variant="default">Source</Badge>;
    }
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
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="e.g., Federal Reserve"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-url">URL</Label>
                <Input
                  id="source-url"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label htmlFor="relationship-type">Relationship</Label>
                <Select 
                  value={newSource.relationship_type} 
                  onValueChange={(value) => setNewSource({ ...newSource, relationship_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="source">Source</SelectItem>
                    <SelectItem value="competitor">Competitor</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain-authority">Domain Authority</Label>
                <Input
                  id="domain-authority"
                  type="number"
                  min="0"
                  max="100"
                  value={newSource.domain_authority || ""}
                  onChange={(e) => setNewSource({ 
                    ...newSource, 
                    domain_authority: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="0-100"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => {
                setShowAddForm(false);
                setEditingSource(null);
                setNewSource({
                  name: "",
                  url: "",
                  priority_tier: 3,
                  relationship_type: "source",
                  domain_authority: null,
                  is_active: true
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
                {tierSources.map((source) => (
                  <div key={source.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{source.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ExternalLink className="h-3 w-3" />
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline truncate max-w-[200px]"
                          >
                            {new URL(source.url).hostname}
                          </a>
                        </div>
                      </div>
                      <Switch 
                        checked={source.is_active}
                        onCheckedChange={(checked) => 
                          toggleSourceMutation.mutate({ id: source.id, is_active: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {getRelationshipBadge(source.relationship_type)}
                      {source.domain_authority && (
                        <Badge variant="outline">DA: {source.domain_authority}</Badge>
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
                ))}
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
