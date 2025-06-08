
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  service: string;
  key_masked: string;
  is_active: boolean;
  created_at: string;
  secret_stored?: boolean;
}

interface ApiKeysTableProps {
  apiKeys: ApiKey[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

const SERVICE_OPTIONS = [
  { value: "perplexity", label: "Perplexity", cost: "$1-5 per 1M tokens" },
  { value: "openai", label: "OpenAI", cost: "$0.15-15 per 1M tokens" },
  { value: "fred", label: "FRED API", cost: "Free" },
  { value: "firecrawl", label: "Firecrawl", cost: "$1-3 per 1K pages" },
  { value: "tavily", label: "Tavily", cost: "$5 per 1K searches" },
  { value: "newsapi", label: "NewsAPI", cost: "$449/month" },
  { value: "serpapi", label: "SerpAPI", cost: "$50 per 5K searches" },
  { value: "other", label: "Other", cost: "Variable" }
];

export function ApiKeysTable({ apiKeys, isLoading, onRefresh }: ApiKeysTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ name: "", service: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", service: "", key: "" });

  const queryClient = useQueryClient();

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.functions.invoke('toggle-api-key-status', {
        body: { id, is_active: !isActive }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onRefresh();
      toast.success('API key status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    }
  });

  const updateKeyMutation = useMutation({
    mutationFn: async ({ id, name, service }: { id: string; name: string; service: string }) => {
      const { error } = await supabase.functions.invoke('api-keys', {
        body: { operation: 'update', id, name, service }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onRefresh();
      toast.success('API key updated');
      setEditingId(null);
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    }
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { id }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onRefresh();
      toast.success('API key deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + error.message);
    }
  });

  const addKeyMutation = useMutation({
    mutationFn: async ({ name, service, key }: { name: string; service: string; key: string }) => {
      const { error } = await supabase.functions.invoke('set-api-key', {
        body: { name, service, key }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onRefresh();
      toast.success('API key added');
      setIsAdding(false);
      setNewKey({ name: "", service: "", key: "" });
    },
    onError: (error) => {
      toast.error('Failed to add key: ' + error.message);
    }
  });

  const handleEdit = (key: ApiKey) => {
    setEditingId(key.id);
    setEditValues({ name: key.name, service: key.service });
  };

  const handleSave = () => {
    if (!editingId) return;
    updateKeyMutation.mutate({
      id: editingId,
      name: editValues.name,
      service: editValues.service
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({ name: "", service: "" });
  };

  const getServiceInfo = (service: string) => {
    return SERVICE_OPTIONS.find(opt => opt.value === service) || { label: service, cost: "Unknown" };
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading API keys...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">API Keys</h3>
        <Button onClick={() => setIsAdding(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add API Key
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isAdding && (
            <TableRow>
              <TableCell>
                <Input
                  value={newKey.name}
                  onChange={(e) => setNewKey(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Key name"
                />
              </TableCell>
              <TableCell>
                <Select value={newKey.service} onValueChange={(value) => setNewKey(prev => ({ ...prev, service: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  type="password"
                  value={newKey.key}
                  onChange={(e) => setNewKey(prev => ({ ...prev, key: e.target.value }))}
                  placeholder="API key"
                />
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {newKey.service ? getServiceInfo(newKey.service).cost : "-"}
                </span>
              </TableCell>
              <TableCell>-</TableCell>
              <TableCell>-</TableCell>
              <TableCell>
                <div className="flex items-center space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addKeyMutation.mutate(newKey)}
                    disabled={!newKey.name || !newKey.service || !newKey.key}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsAdding(false);
                      setNewKey({ name: "", service: "", key: "" });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
          
          {apiKeys.map((key) => (
            <TableRow key={key.id}>
              <TableCell>
                {editingId === key.id ? (
                  <Input
                    value={editValues.name}
                    onChange={(e) => setEditValues(prev => ({ ...prev, name: e.target.value }))}
                  />
                ) : (
                  <span className="font-medium">{key.name}</span>
                )}
              </TableCell>
              <TableCell>
                {editingId === key.id ? (
                  <Select value={editValues.service} onValueChange={(value) => setEditValues(prev => ({ ...prev, service: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="capitalize">
                    {getServiceInfo(key.service).label}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm">{key.key_masked}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {getServiceInfo(key.service).cost}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant={key.is_active ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleStatusMutation.mutate({ id: key.id, isActive: key.is_active })}
                >
                  {key.is_active ? "Active" : "Inactive"}
                </Button>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {new Date(key.created_at).toLocaleDateString()}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-1">
                  {editingId === key.id ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={handleSave}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancel}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(key)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteKeyMutation.mutate(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {apiKeys.length === 0 && !isAdding && (
        <div className="text-center py-8 text-muted-foreground">
          No API keys configured. Click "Add API Key" to get started.
        </div>
      )}
    </div>
  );
}
