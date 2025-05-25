
import { Button } from "@/components/ui/button";
import { List, LayoutGrid } from "lucide-react";

interface ViewToggleProps {
  view: 'list' | 'kanban';
  onViewChange: (view: 'list' | 'kanban') => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex border rounded-md">
      <Button
        variant={view === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('list')}
        className="rounded-r-none"
      >
        <List className="h-4 w-4 mr-1" />
        List
      </Button>
      <Button
        variant={view === 'kanban' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('kanban')}
        className="rounded-l-none"
      >
        <LayoutGrid className="h-4 w-4 mr-1" />
        Kanban
      </Button>
    </div>
  );
}
