
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight, RefreshCw, Filter } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDistanceToNow } from "date-fns";

interface JobLog {
  id: string;
  job_name: string;
  status: string;
  message: string | null;
  execution_time: string;
  details: any;
  created_at: string;
}

interface SyncOperation {
  id: string;
  operation_type: string;
  status: string;
  total_items: number;
  completed_items: number;
  created_at: string;
  updated_at: string;
  results_summary: any;
  error_details: any;
}

const JobExecutionLogsTable = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: jobLogs, isLoading: isLoadingJobs, refetch: refetchJobs } = useQuery({
    queryKey: ["job-logs", statusFilter, typeFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("job_logs")
        .select("*")
        .order("execution_time", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchTerm) {
        query = query.ilike("job_name", `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as JobLog[];
    },
  });

  const { data: syncOps, isLoading: isLoadingSyncs, refetch: refetchSyncs } = useQuery({
    queryKey: ["sync-operations", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("sync_operations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SyncOperation[];
    },
  });

  const combinedLogs = [
    ...(jobLogs?.map(log => ({
      id: log.id,
      type: "job",
      name: log.job_name,
      status: log.status,
      timestamp: log.execution_time,
      message: log.message,
      details: log.details,
      duration: null
    })) || []),
    ...(syncOps?.map(op => ({
      id: op.id,
      type: "sync",
      name: op.operation_type,
      status: op.status,
      timestamp: op.created_at,
      message: `${op.completed_items}/${op.total_items} items processed`,
      details: { results: op.results_summary, errors: op.error_details },
      duration: op.updated_at ? new Date(op.updated_at).getTime() - new Date(op.created_at).getTime() : null
    })) || [])
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredLogs = combinedLogs.filter(log => {
    if (typeFilter !== "all" && log.type !== typeFilter) return false;
    if (searchTerm && !log.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "success":
      case "completed":
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case "error":
      case "failed":
        return <Badge variant="destructive">Error</Badge>;
      case "running":
      case "pending":
        return <Badge variant="outline">Running</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDuration = (duration: number | null) => {
    if (!duration) return "—";
    const seconds = Math.round(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  const isLoading = isLoadingJobs || isLoadingSyncs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Execution Logs</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            refetchJobs();
            refetchSyncs();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="running">Running</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="job">Jobs</SelectItem>
              <SelectItem value="sync">Sync Ops</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">Loading execution logs...</div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Job/Operation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No execution logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <>
                    <TableRow key={log.id} className="cursor-pointer" onClick={() => toggleRowExpansion(log.id)}>
                      <TableCell>
                        {expandedRows.has(log.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{new Date(log.timestamp).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{log.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{log.type}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDuration(log.duration)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {log.message || "—"}
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(log.id) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/50">
                          <div className="p-4 space-y-2">
                            <div className="text-sm">
                              <strong>Full Message:</strong> {log.message || "No message"}
                            </div>
                            {log.details && (
                              <div className="text-sm">
                                <strong>Details:</strong>
                                <pre className="mt-1 text-xs bg-background p-2 rounded border overflow-auto max-h-32">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default JobExecutionLogsTable;
