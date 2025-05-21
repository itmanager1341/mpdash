import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DialogFooter } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface KeywordCluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  description?: string;
  keywords?: string[];
  professions?: string[];
  created_at: string;
}

interface ClusterFormProps {
  cluster: KeywordCluster | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const ClusterForm = ({ cluster, onCancel, onSuccess }: ClusterFormProps) => {
  const [primaryTheme, setPrimaryTheme] = useState(cluster?.primary_theme || "");
  const [subTheme, setSubTheme] = useState(cluster?.sub_theme || "");
  const [description, setDescription] = useState(cluster?.description || "");
  const [keywords, setKeywords] = useState<string[]>(cluster?.keywords || []);
  const [professions, setProfessions] = useState<string[]>(cluster?.professions || []);
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [currentProfession, setCurrentProfession] = useState("");
  
  // Existing primary themes for autocomplete
  const [primaryThemes, setPrimaryThemes] = useState<string[]>([]);

  // Fetch existing primary themes for suggestions
  useEffect(() => {
    const fetchPrimaryThemes = async () => {
      try {
        const { data, error } = await supabase
          .from('keyword_clusters')
          .select('primary_theme')
          .order('primary_theme');
        
        if (error) throw error;
        
        // Extract unique primary themes
        const uniqueThemes = Array.from(new Set(data.map(item => item.primary_theme)));
        setPrimaryThemes(uniqueThemes);
      } catch (err) {
        console.error("Error fetching primary themes:", err);
      }
    };
    
    fetchPrimaryThemes();
  }, []);

  const saveCluster = useMutation({
    mutationFn: async () => {
      // Validate required fields
      if (!primaryTheme || !subTheme) {
        throw new Error("Primary theme and sub-theme are required");
      }
      
      if (cluster?.id) {
        // Update existing cluster
        const { error } = await supabase
          .from('keyword_clusters')
          .update({
            primary_theme: primaryTheme,
            sub_theme: subTheme,
            description,
            keywords,
            professions
          })
          .eq('id', cluster.id);
          
        if (error) throw error;
      } else {
        // Create new cluster
        const { error } = await supabase
          .from('keyword_clusters')
          .insert({
            primary_theme: primaryTheme,
            sub_theme: subTheme,
            description,
            keywords,
            professions
          });
          
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

  const handleAddKeyword = () => {
    if (currentKeyword && !keywords.includes(currentKeyword)) {
      setKeywords([...keywords, currentKeyword]);
      setCurrentKeyword("");
    }
  };

  const handleAddProfession = () => {
    if (currentProfession && !professions.includes(currentProfession)) {
      setProfessions([...professions, currentProfession]);
      setCurrentProfession("");
    }
  };

  const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  const handleProfessionKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddProfession();
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const removeProfession = (profession: string) => {
    setProfessions(professions.filter(p => p !== profession));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveCluster.mutate();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary-theme">Primary Theme</Label>
            <Input
              id="primary-theme"
              value={primaryTheme}
              onChange={(e) => setPrimaryTheme(e.target.value)}
              placeholder="e.g., Mortgage Rates"
              list="primary-theme-options"
              required
            />
            <datalist id="primary-theme-options">
              {primaryThemes.map((theme) => (
                <option key={theme} value={theme} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-theme">Sub-Theme</Label>
            <Input
              id="sub-theme"
              value={subTheme}
              onChange={(e) => setSubTheme(e.target.value)}
              placeholder="e.g., Rate Trends"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this keyword cluster..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="keywords">Keywords</Label>
          <div className="flex gap-2">
            <Input
              id="keywords"
              value={currentKeyword}
              onChange={(e) => setCurrentKeyword(e.target.value)}
              onKeyPress={handleKeywordKeyPress}
              placeholder="Add keywords..."
            />
            <Button type="button" onClick={handleAddKeyword}>Add</Button>
          </div>
          
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {keywords.map((keyword, idx) => (
                <Badge key={idx} variant="secondary" className="pr-1.5">
                  {keyword}
                  <button
                    type="button"
                    onClick={() => removeKeyword(keyword)}
                    className="ml-1.5 rounded-full hover:bg-secondary-foreground/10"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove {keyword}</span>
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="professions">Target Professions</Label>
          <div className="flex gap-2">
            <Input
              id="professions"
              value={currentProfession}
              onChange={(e) => setCurrentProfession(e.target.value)}
              onKeyPress={handleProfessionKeyPress}
              placeholder="Add relevant professions..."
            />
            <Button type="button" onClick={handleAddProfession}>Add</Button>
          </div>
          
          {professions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {professions.map((profession, idx) => (
                <Badge key={idx} variant="outline" className="pr-1.5">
                  {profession}
                  <button
                    type="button"
                    onClick={() => removeProfession(profession)}
                    className="ml-1.5 rounded-full hover:bg-secondary-foreground/10"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove {profession}</span>
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!primaryTheme || !subTheme || saveCluster.isPending}
        >
          {saveCluster.isPending ? "Saving..." : cluster ? "Update Cluster" : "Create Cluster"}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default ClusterForm;
