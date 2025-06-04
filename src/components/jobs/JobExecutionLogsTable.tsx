
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, RefreshCw, Filter, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JobExecutionLog {
  id: string;
  job_name: string;
  execution_type: 'scheduled' | 'manual' | 'test';
  status: 'running' | 'success' | 'error' | 'cancelled';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  message: string | null;
  details: any;
  parameters_used: any;
  triggered_by: string | null;
}

interface ExecutionLog {
  id: string;
  type: 'job' | 'llm' | 'sync';
  name: string;
  status: string;
  timestamp: string;
  message: string | null;
  details: any;
  duration: number | null;
  execution_type?: string;
}

const JobExecutionLogsTable = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [executionTypeFilter, setExecutionTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch job execution logs
  const { data: jobLogs, isLoading: isLoadingJobs, refetch: refetchJobs } = useQuery({
    queryKey: ["job-execution-logs", statusFilter, executionTypeFilter],
    queryFn: async () => {
      let query = supabase
        .from("job_execution_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      if (executionTypeFilter !== "all") {
        query = query.eq("execution_type", executionTypeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: llmLogs, isLoading: isLoadingLlm, refetch: refetchLlm } = useQuery({
    queryKey: ["llm-usage-logs", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("llm_usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: syncOps, isLoading: isLoadingSyncs, refetch: refetchSyncs } = useQuery({
    queryKey: ["sync-operations", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("sync_operations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const combinedLogs: ExecutionLog[] = [
    // Job execution logs
    ...(jobLogs?.map(log => ({
      id: log.id,
      type: 'job' as const,
      name: log.job_name,
      status: log.status,
      timestamp: log.started_at,
      message: log.message || `${log.execution_type} execution`,
      details: { 
        execution_type: log.execution_type,
        parameters_used: log.parameters_used,
        job_details: log.details,
        completed_at: log.completed_at,
        triggered_by: log.triggered_by
      },
      duration: log.duration_ms,
      execution_type: log.execution_type
    })) || []),
    
    // LLM usage logs
    ...(llmLogs?.map(log => ({
      id: log.id,
      type: 'llm' as const,
      name: log.function_name,
      status: log.status,
      timestamp: log.created_at,
      message: `${log.model} - ${log.total_tokens} tokens`,
      details: { 
        model: log.model,
        tokens: log.total_tokens,
        cost: log.estimated_cost,
        metadata: log.operation_metadata 
      },
      duration: log.duration_ms
    })) || []),
    
    // Sync operations
    ...(syncOps?.map(op => ({
      id: op.id,
      type: 'sync' as const,
      name: op.operation_type,
      status: op.status,
      timestamp: op.created_at,
      message: `${op.completed_items}/${op.total_items} items processed`,
      details: { 
        results: op.results_summary, 
        errors: op.error_details,
        decisions: op.merge_decisions 
      },
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

  const getStatusIcon = (status: string, type: string) => {
    switch (status.toLowerCase()) {
      case "success":
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "error":
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
      case "pending":
        return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string, execution_type?: string) => {
    const variant = (() => {
      switch (status.toLowerCase()) {
        case "success":
        case "completed":
          return "default";
        case "error":
        case "failed":
          return "destructive";
        case "running":
        case "pending":
          return "outline";
        default:
          return "secondary";
      }
    })();

    return (
      <div className="flex items-center gap-2">
        {getStatusIcon(status, execution_type || '')}
        <Badge variant={variant as any}>
          {status}
          {execution_type && execution_type !== 'scheduled' && (
            <span className="ml-1 text-xs">({execution_type})</span>
          )}
        </Badge>
      </div>
    );
  };

  const formatDuration = (duration: number | null) => {
    if (!duration) return "—";
    const seconds = Math.round(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'job':
        return '🔄';
      case 'llm':
        return '🤖';
      case 'sync':
        return '🔄';
      default:
        return '📝';
    }
  };

  const isLoading = isLoadingJobs || isLoadingLlm || isLoadingSyncs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Execution Logs</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            refetchJobs();
            refetchLlm();
            refetchSyncs();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Enhanced Filters */}
      <div className="flex flex-wrap items-center gap-4">
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
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="job">Jobs</SelectItem>
              <SelectItem value="llm">LLM</SelectItem>
              <SelectItem value="sync">Sync</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={executionTypeFilter} onValueChange={setExecutionTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exec Types</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="test">Test</SelectItem>
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
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Loading execution logs...</p>
          </div>
        </div>
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
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                      <p>No execution logs found</p>
                      <p className="text-sm">Try adjusting your filters or check back later</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <>
                    <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpansion(log.id)}>
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
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{getTypeIcon(log.type)}</span>
                          {log.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{log.type}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status, log.execution_type)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDuration(log.duration)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {log.message || "—"}
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(log.id) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium text-sm mb-2">Execution Details</h4>
                                <div className="text-sm space-y-1">
                                  <div><strong>Type:</strong> {log.type}</div>
                                  <div><strong>Status:</strong> {log.status}</div>
                                  {log.execution_type && (
                                    <div><strong>Execution Type:</strong> {log.execution_type}</div>
                                  )}
                                  <div><strong>Started:</strong> {new Date(log.timestamp).toLocaleString()}</div>
                                  {log.details?.completed_at && (
                                    <div><strong>Completed:</strong> {new Date(log.details.completed_at).toLocaleString()}</div>
                                  )}
                                  {log.duration && (
                                    <div><strong>Duration:</strong> {formatDuration(log.duration)}</div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="font-medium text-sm mb-2">Message</h4>
                                <p className="text-sm bg-background p-2 rounded border">
                                  {log.message || "No message provided"}
                                </p>
                              </div>
                            </div>
                            
                            {log.details && (
                              <div>
                                <h4 className="font-medium text-sm mb-2">Additional Details</h4>
                                <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-64 whitespace-pre-wrap">
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
