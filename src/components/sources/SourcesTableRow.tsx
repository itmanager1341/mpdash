
import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Check, X } from "lucide-react";
import { Source } from "./SourcesTable";

interface SourcesTableRowProps {
  source: Source;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onUpdate: (id: string, updates: Partial<Source>) => void;
  onDelete: (id: string) => void;
}

export function SourcesTableRow({
  source,
  isSelected,
  onSelect,
  onUpdate,
  onDelete
}: SourcesTableRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    source_name: source.source_name,
    source_url: source.source_url,
    source_type: source.source_type || '',
    priority_tier: source.priority_tier?.toString() || ''
  });

  const handleSave = () => {
    const updates: Partial<Source> = {
      source_name: editValues.source_name,
      source_url: editValues.source_url,
      source_type: editValues.source_type || null,
      priority_tier: editValues.priority_tier ? parseInt(editValues.priority_tier) : null
    };
    
    onUpdate(source.id, updates);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({
      source_name: source.source_name,
      source_url: source.source_url,
      source_type: source.source_type || '',
      priority_tier: source.priority_tier?.toString() || ''
    });
    setIsEditing(false);
  };

  const getPriorityBadgeVariant = (tier: number | null) => {
    switch (tier) {
      case 1: return "destructive";
      case 2: return "default";
      case 3: return "secondary";
      case 4: return "outline";
      default: return "outline";
    }
  };

  return (
    <TableRow>
      <TableCell>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
        />
      </TableCell>
      
      <TableCell>
        {isEditing ? (
          <Input
            value={editValues.source_name}
            onChange={(e) => setEditValues(prev => ({ ...prev, source_name: e.target.value }))}
            className="min-w-[200px]"
          />
        ) : (
          <div className="font-medium">{source.source_name}</div>
        )}
      </TableCell>
      
      <TableCell>
        {isEditing ? (
          <Input
            value={editValues.source_url}
            onChange={(e) => setEditValues(prev => ({ ...prev, source_url: e.target.value }))}
            className="min-w-[250px]"
            type="url"
          />
        ) : (
          <a 
            href={source.source_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline truncate block max-w-[250px]"
          >
            {source.source_url}
          </a>
        )}
      </TableCell>
      
      <TableCell>
        {isEditing ? (
          <Select 
            value={editValues.source_type} 
            onValueChange={(value) => setEditValues(prev => ({ ...prev, source_type: value }))}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="news">News</SelectItem>
              <SelectItem value="blog">Blog</SelectItem>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="industry">Industry</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          source.source_type && (
            <Badge variant="outline" className="capitalize">
              {source.source_type}
            </Badge>
          )
        )}
      </TableCell>
      
      <TableCell>
        {isEditing ? (
          <Select 
            value={editValues.priority_tier} 
            onValueChange={(value) => setEditValues(prev => ({ ...prev, priority_tier: value }))}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          source.priority_tier && (
            <Badge variant={getPriorityBadgeVariant(source.priority_tier)}>
              Tier {source.priority_tier}
            </Badge>
          )
        )}
      </TableCell>
      
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {source.cluster_alignment?.map((cluster, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {cluster}
            </Badge>
          ))}
        </div>
      </TableCell>
      
      <TableCell>
        <div className="text-sm text-muted-foreground">
          {new Date(source.created_at).toLocaleDateString()}
        </div>
      </TableCell>
      
      <TableCell>
        <div className="flex items-center space-x-1">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSave}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(source.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
