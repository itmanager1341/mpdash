
import { useDrop } from 'react-dnd';
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import DraggableDraftCard from './DraggableDraftCard';

interface StatusColumnProps {
  status: string;
  title: string;
  color: string;
  drafts: any[];
  selectedDraft: any;
  onDraftSelect: (draft: any) => void;
  onDraftMoved: () => void;
}

export default function StatusColumn({ 
  status, 
  title, 
  color, 
  drafts, 
  selectedDraft, 
  onDraftSelect,
  onDraftMoved 
}: StatusColumnProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'draft',
    drop: async (item: { id: string; draft: any }) => {
      if (item.draft.status === status) return;
      
      try {
        const { error } = await supabase
          .from('articles')
          .update({ status })
          .eq('id', item.id);

        if (error) throw error;

        toast.success(`Draft moved to ${title}`);
        onDraftMoved();
      } catch (error) {
        console.error('Error moving draft:', error);
        toast.error('Failed to move draft');
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-medium">{title}</h3>
        <Badge variant="secondary" className={color}>
          {drafts.length}
        </Badge>
      </div>
      
      <Card
        ref={drop}
        className={`min-h-96 p-3 space-y-2 transition-colors ${
          isOver && canDrop ? 'bg-primary/5 border-primary' : ''
        } ${
          canDrop ? 'border-dashed' : ''
        }`}
      >
        {drafts.map((draft) => (
          <DraggableDraftCard
            key={draft.id}
            draft={draft}
            isSelected={selectedDraft?.id === draft.id}
            onSelect={onDraftSelect}
          />
        ))}
        
        {drafts.length === 0 && (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            {isOver && canDrop ? 'Drop here' : 'No drafts'}
          </div>
        )}
      </Card>
    </div>
  );
}
