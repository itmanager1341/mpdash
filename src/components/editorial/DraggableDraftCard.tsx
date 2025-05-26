
import { useDrag } from 'react-dnd';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  Clock, 
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  GripVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DraggableDraftCardProps {
  draft: any;
  isSelected: boolean;
  onSelect: (draft: any) => void;
}

export default function DraggableDraftCard({ draft, isSelected, onSelect }: DraggableDraftCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'draft',
    item: { id: draft.id, draft },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'in_review': return 'bg-blue-100 text-blue-800';
      case 'revision_needed': return 'bg-orange-100 text-orange-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'published': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'in_review': return 'In Review';
      case 'revision_needed': return 'Needs Revision';
      case 'approved': return 'Approved';
      case 'published': return 'Published';
      default: return status;
    }
  };

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'news': return { label: 'News', color: 'bg-blue-50 text-blue-700' };
      case 'document': return { label: 'Doc', color: 'bg-green-50 text-green-700' };
      case 'manual': return { label: 'Manual', color: 'bg-gray-50 text-gray-700' };
      default: return null;
    }
  };

  const contentVariants = draft.content_variants as any;
  const sourceBadge = getSourceBadge(draft.source_type);

  return (
    <Card
      ref={drag}
      className={`p-3 cursor-pointer transition-all duration-200 ${
        isDragging ? 'opacity-50 rotate-3 scale-105' : ''
      } ${
        isSelected ? 'ring-2 ring-primary bg-accent' : ''
      } hover:bg-accent hover:shadow-md`}
      onClick={() => onSelect(draft)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2 flex-1">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
          <h4 className="font-medium text-sm line-clamp-2">
            {draft.title || draft.theme || contentVariants?.editorial_content?.headline || 'Untitled Draft'}
          </h4>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Edit className="h-3 w-3 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy className="h-3 w-3 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="h-3 w-3 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(draft.updated_at || draft.created_at).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-1">
          {sourceBadge && (
            <Badge variant="outline" className={`text-xs ${sourceBadge.color}`}>
              {sourceBadge.label}
            </Badge>
          )}
          <Badge variant="outline" className={getStatusColor(draft.status)}>
            {getStatusLabel(draft.status)}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2">
        {contentVariants?.editorial_content?.summary || draft.summary || 'No summary available'}
      </p>

      {draft.destinations && draft.destinations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {draft.destinations.slice(0, 2).map((dest: string, index: number) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {dest}
            </Badge>
          ))}
          {draft.destinations.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{draft.destinations.length - 2} more
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
