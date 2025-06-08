
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Trash2, Search } from "lucide-react";

interface SourcesTableToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  selectedCount: number;
  onBulkDelete: () => void;
  onExport: () => void;
  onAddNew: () => void;
}

export function SourcesTableToolbar({
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  selectedCount,
  onBulkDelete,
  onExport,
  onAddNew
}: SourcesTableToolbarProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sources..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="news">News</SelectItem>
            <SelectItem value="blog">Blog</SelectItem>
            <SelectItem value="research">Research</SelectItem>
            <SelectItem value="government">Government</SelectItem>
            <SelectItem value="industry">Industry</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Priorities</SelectItem>
            <SelectItem value="1">Priority 1</SelectItem>
            <SelectItem value="2">Priority 2</SelectItem>
            <SelectItem value="3">Priority 3</SelectItem>
            <SelectItem value="4">Priority 4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete {selectedCount} selected
          </Button>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        
        <Button
          size="sm"
          onClick={onAddNew}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Source
        </Button>
      </div>
    </div>
  );
}
