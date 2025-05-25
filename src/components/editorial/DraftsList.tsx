
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import DraggableDraftCard from './DraggableDraftCard';

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
        <DraggableDraftCard
          key={draft.id}
          draft={draft}
          isSelected={selectedDraft?.id === draft.id}
          onSelect={onDraftSelect}
        />
      ))}
    </div>
  );
}
