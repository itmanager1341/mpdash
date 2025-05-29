
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Author } from "@/types/author";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AuthorSelectorProps {
  selectedAuthorId?: string;
  onAuthorChange: (authorId: string | undefined) => void;
  className?: string;
}

export function AuthorSelector({ selectedAuthorId, onAuthorChange, className }: AuthorSelectorProps) {
  const [isAddingAuthor, setIsAddingAuthor] = useState(false);
  const [newAuthor, setNewAuthor] = useState({
    name: '',
    email: '',
    bio: '',
    author_type: 'internal' as const,
    expertise_areas: [] as string[]
  });

  const { data: authors, isLoading, refetch } = useQuery({
    queryKey: ['authors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('authors')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Author[];
    }
  });

  const selectedAuthor = authors?.find(author => author.id === selectedAuthorId);

  const handleAddAuthor = async () => {
    try {
      const { data, error } = await supabase
        .from('authors')
        .insert([newAuthor])
        .select()
        .single();

      if (error) throw error;

      toast.success("Author added successfully");
      setIsAddingAuthor(false);
      setNewAuthor({
        name: '',
        email: '',
        bio: '',
        author_type: 'internal',
        expertise_areas: []
      });
      refetch();
      onAuthorChange(data.id);
    } catch (error) {
      console.error("Error adding author:", error);
      toast.error("Failed to add author");
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex items-center gap-2">
        <User className="h-4 w-4" />
        Author
      </Label>
      
      <div className="flex gap-2">
        <Select 
          value={selectedAuthorId || ""} 
          onValueChange={(value) => onAuthorChange(value || undefined)}
          disabled={isLoading}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select an author..." />
          </SelectTrigger>
          <SelectContent>
            {authors?.map((author) => (
              <SelectItem key={author.id} value={author.id}>
                <div className="flex items-center gap-2">
                  <span>{author.name}</span>
                  <Badge 
                    variant={author.author_type === 'internal' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {author.author_type}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={isAddingAuthor} onOpenChange={setIsAddingAuthor}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Author</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newAuthor.name}
                  onChange={(e) => setNewAuthor({ ...newAuthor, name: e.target.value })}
                  placeholder="Author name"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newAuthor.email}
                  onChange={(e) => setNewAuthor({ ...newAuthor, email: e.target.value })}
                  placeholder="author@example.com"
                />
              </div>
              
              <div>
                <Label htmlFor="author_type">Author Type</Label>
                <Select
                  value={newAuthor.author_type}
                  onValueChange={(value: 'internal' | 'external' | 'contributor') => 
                    setNewAuthor({ ...newAuthor, author_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal Staff</SelectItem>
                    <SelectItem value="external">External Contributor</SelectItem>
                    <SelectItem value="contributor">Guest Contributor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={newAuthor.bio}
                  onChange={(e) => setNewAuthor({ ...newAuthor, bio: e.target.value })}
                  placeholder="Brief author biography"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddingAuthor(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAuthor} disabled={!newAuthor.name}>
                  Add Author
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {selectedAuthor && (
        <div className="p-3 bg-muted rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{selectedAuthor.name}</span>
            <Badge variant={selectedAuthor.author_type === 'internal' ? 'default' : 'secondary'}>
              {selectedAuthor.author_type}
            </Badge>
          </div>
          {selectedAuthor.bio && (
            <p className="text-sm text-muted-foreground">{selectedAuthor.bio}</p>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            {selectedAuthor.article_count} articles published
          </div>
        </div>
      )}
    </div>
  );
}
