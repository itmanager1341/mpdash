
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { SourcesTableToolbar } from "./SourcesTableToolbar";
import { SourcesTableRow } from "./SourcesTableRow";
import { AddSourceDialog } from "./AddSourceDialog";
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";

export interface Source {
  id: string;
  source_name: string;
  source_url: string;
  source_type: string | null;
  priority_tier: number | null;
  cluster_alignment: string[] | null;
  created_at: string;
}

type SortKey = 'source_name' | 'source_url' | 'source_type' | 'priority_tier' | 'created_at';

export default function SourcesTable() {
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const queryClient = useQueryClient();

  const { data: sources = [], isLoading, error } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Source[];
    }
  });

  const updateSourceMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Source> }) => {
      const { error } = await supabase
        .from('sources')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast.success('Source updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update source: ' + error.message);
    }
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sources')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast.success('Source deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete source: ' + error.message);
    }
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleUpdateSource = (id: string, updates: Partial<Source>) => {
    updateSourceMutation.mutate({ id, updates });
  };

  const handleDeleteSource = (id: string) => {
    deleteSourceMutation.mutate(id);
  };

  const handleBulkDelete = () => {
    selectedSources.forEach(id => deleteSourceMutation.mutate(id));
    setSelectedSources([]);
  };

  const handleExport = () => {
    const csvContent = [
      ['Name', 'URL', 'Type', 'Priority Tier', 'Created Date'].join(','),
      ...filteredAndSortedSources.map(source => [
        source.source_name,
        source.source_url,
        source.source_type || '',
        source.priority_tier?.toString() || '',
        new Date(source.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sources.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAndSortedSources = sources
    .filter(source => {
      const matchesSearch = source.source_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           source.source_url.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = !typeFilter || source.source_type === typeFilter;
      const matchesPriority = !priorityFilter || source.priority_tier?.toString() === priorityFilter;
      return matchesSearch && matchesType && matchesPriority;
    })
    .sort((a, b) => {
      let aValue: any = a[sortKey];
      let bValue: any = b[sortKey];
      
      if (sortKey === 'created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Error loading sources: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SourcesTableToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        selectedCount={selectedSources.length}
        onBulkDelete={handleBulkDelete}
        onExport={handleExport}
        onAddNew={() => setShowAddDialog(true)}
      />
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedSources.length === filteredAndSortedSources.length && filteredAndSortedSources.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSources(filteredAndSortedSources.map(s => s.id));
                    } else {
                      setSelectedSources([]);
                    }
                  }}
                />
              </TableHead>
              <SortableTableHead
                sortKey="source_name"
                currentSort={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Source Name
              </SortableTableHead>
              <SortableTableHead
                sortKey="source_url"
                currentSort={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                URL
              </SortableTableHead>
              <SortableTableHead
                sortKey="source_type"
                currentSort={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Type
              </SortableTableHead>
              <SortableTableHead
                sortKey="priority_tier"
                currentSort={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Priority
              </SortableTableHead>
              <TableHead>Cluster Alignment</TableHead>
              <SortableTableHead
                sortKey="created_at"
                currentSort={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Created
              </SortableTableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading sources...
                </TableCell>
              </TableRow>
            ) : filteredAndSortedSources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No sources found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedSources.map((source) => (
                <SourcesTableRow
                  key={source.id}
                  source={source}
                  isSelected={selectedSources.includes(source.id)}
                  onSelect={(selected) => {
                    if (selected) {
                      setSelectedSources([...selectedSources, source.id]);
                    } else {
                      setSelectedSources(selectedSources.filter(id => id !== source.id));
                    }
                  }}
                  onUpdate={handleUpdateSource}
                  onDelete={handleDeleteSource}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AddSourceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </div>
  );
}
