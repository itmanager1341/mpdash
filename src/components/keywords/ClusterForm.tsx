
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

interface KeywordCluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  description?: string;
  keywords?: string[];
  professions?: string[];
  priority_weight?: number;
  created_at: string;
}

interface ClusterFormProps {
  cluster?: KeywordCluster | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const ClusterForm = ({ cluster, onCancel, onSuccess }: ClusterFormProps) => {
  const [formData, setFormData] = useState({
    primary_theme: cluster?.primary_theme || "",
    sub_theme: cluster?.sub_theme || "",
    description: cluster?.description || "",
    keywords: cluster?.keywords || [],
    professions: cluster?.professions || [],
    priority_weight: cluster?.priority_weight || 50
  });
  
  const [newKeyword, setNewKeyword] = useState("");
  const [newProfession, setNewProfession] = useState("");

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (cluster) {
        const { error } = await supabase
          .from('keyword_clusters')
          .update(data)
          .eq('id', cluster.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('keyword_clusters')
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to save cluster: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.primary_theme.trim() || !formData.sub_theme.trim()) {
      toast.error("Primary theme and sub-theme are required");
      return;
    }
    
    saveMutation.mutate(formData);
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()]
      }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  const addProfession = () => {
    if (newProfession.trim() && !formData.professions.includes(newProfession.trim())) {
      setFormData(prev => ({
        ...prev,
        professions: [...prev.professions, newProfession.trim()]
      }));
      setNewProfession("");
    }
  };

  const removeProfession = (profession: string) => {
    setFormData(prev => ({
      ...prev,
      professions: prev.professions.filter(p => p !== profession)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="primary_theme">Primary Theme</Label>
          <Input
            id="primary_theme"
            value={formData.primary_theme}
            onChange={(e) => setFormData(prev => ({ ...prev, primary_theme: e.target.value }))}
            placeholder="e.g., Lending, Technology"
            required
          />
        </div>
        <div>
          <Label htmlFor="sub_theme">Sub-theme</Label>
          <Input
            id="sub_theme"
            value={formData.sub_theme}
            onChange={(e) => setFormData(prev => ({ ...prev, sub_theme: e.target.value }))}
            placeholder="e.g., Purchase Mortgages, LOS Systems"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="priority_weight">Priority Weight (0-100)</Label>
        <Input
          id="priority_weight"
          type="number"
          min="0"
          max="100"
          value={formData.priority_weight}
          onChange={(e) => setFormData(prev => ({ ...prev, priority_weight: Number(e.target.value) }))}
          placeholder="50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Higher weights get priority in news search and content suggestions
        </p>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description of this cluster's focus"
        />
      </div>

      <div>
        <Label>Keywords</Label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Add keyword"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
          />
          <Button type="button" onClick={addKeyword} variant="outline" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {formData.keywords.map((keyword, idx) => (
            <Badge key={idx} variant="outline" className="bg-primary/5">
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label>Relevant Professions</Label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newProfession}
            onChange={(e) => setNewProfession(e.target.value)}
            placeholder="Add profession"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProfession())}
          />
          <Button type="button" onClick={addProfession} variant="outline" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {formData.professions.map((profession, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {profession}
              <button
                type="button"
                onClick={() => removeProfession(profession)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : cluster ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
};

export default ClusterForm;
