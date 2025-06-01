
import { TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTableHead({
  children,
  sortKey,
  currentSort,
  sortDirection,
  onSort,
  className
}: SortableTableHeadProps) {
  const handleClick = () => {
    onSort(sortKey);
  };

  const getSortIcon = () => {
    if (currentSort !== sortKey) {
      return <ChevronsUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />;
  };

  return (
    <TableHead className={className}>
      <Button
        variant="ghost"
        onClick={handleClick}
        className="h-auto p-0 font-medium hover:bg-transparent flex items-center gap-1"
      >
        {children}
        {getSortIcon()}
      </Button>
    </TableHead>
  );
}
