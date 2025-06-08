
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSourceDialog({ open, onOpenChange }: AddSourceDialogProps) {
  const [formData, setFormData] = useState({
    source_name: '',
    source_url: '',
    source_type: '',
    priority_tier: ''
  });

  const queryClient = useQueryClient();

  const addSourceMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('sources')
        .insert([{
          source_name: data.source_name,
          source_url: data.source_url,
          source_type: data.source_type || null,
          priority_tier: data.priority_tier ? parseInt(data.priority_tier) : null
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast.success('Source added successfully');
      onOpenChange(false);
      setFormData({
        source_name: '',
        source_url: '',
        source_type: '',
        priority_tier: ''
      });
    },
    onError: (error) => {
      toast.error('Failed to add source: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.source_name || !formData.source_url) {
      toast.error('Please fill in required fields');
      return;
    }
    addSourceMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Source</DialogTitle>
          <DialogDescription>
            Add a new news source to your collection. Required fields are marked with an asterisk.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source_name">Source Name *</Label>
            <Input
              id="source_name"
              value={formData.source_name}
              onChange={(e) => setFormData(prev => ({ ...prev, source_name: e.target.value }))}
              placeholder="e.g., Reuters, CNN, TechCrunch"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="source_url">URL *</Label>
            <Input
              id="source_url"
              type="url"
              value={formData.source_url}
              onChange={(e) => setFormData(prev => ({ ...prev, source_url: e.target.value }))}
              placeholder="https://example.com"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="source_type">Source Type</Label>
            <Select 
              value={formData.source_type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, source_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="government">Government</SelectItem>
                <SelectItem value="industry">Industry</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priority_tier">Priority Tier</Label>
            <Select 
              value={formData.priority_tier} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority_tier: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Tier 1 (Highest)</SelectItem>
                <SelectItem value="2">Tier 2</SelectItem>
                <SelectItem value="3">Tier 3</SelectItem>
                <SelectItem value="4">Tier 4 (Lowest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addSourceMutation.isPending}>
              {addSourceMutation.isPending ? 'Adding...' : 'Add Source'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
