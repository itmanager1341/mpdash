
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  Clock, 
  User, 
  MoreVertical,
  Edit,
  Trash2,
  Copy
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DraftsListProps {
  drafts: any[];
  selectedDraft: any;
  onDraftSelect: (draft: any) => void;
  isLoading: boolean;
  activeView: string;
}

export default function DraftsList({ 
  drafts, 
  selectedDraft, 
  onDraftSelect, 
  isLoading,
  activeView 
}: DraftsListProps) {
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

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  if (!drafts || drafts.length === 0) {
    return (
      <div className="p-6 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-medium mb-1">No drafts found</h3>
        <p className="text-sm text-muted-foreground">
          {activeView === 'drafts' ? 'Create your first draft to get started' : 'No items in this category'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {drafts.map((draft) => (
        <Card
          key={draft.id}
          className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
            selectedDraft?.id === draft.id ? 'ring-2 ring-primary bg-accent' : ''
          }`}
          onClick={() => onDraftSelect(draft)}
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-sm line-clamp-2">
              {draft.content_variants?.editorial_content?.headline || draft.title || 'Untitled Draft'}
            </h4>
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
              {new Date(draft.updated_at).toLocaleDateString()}
            </div>
            <Badge variant="outline" className={getStatusColor(draft.status)}>
              {getStatusLabel(draft.status)}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2">
            {draft.content_variants?.editorial_content?.summary || 'No summary available'}
          </p>

          {draft.matched_clusters && draft.matched_clusters.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {draft.matched_clusters.slice(0, 2).map((cluster: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {cluster}
                </Badge>
              ))}
              {draft.matched_clusters.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{draft.matched_clusters.length - 2} more
                </Badge>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
