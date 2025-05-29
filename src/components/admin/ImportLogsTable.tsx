
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Calendar, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ImportLog {
  id: string;
  import_started_at: string;
  import_completed_at?: string;
  date_range_start?: string;
  date_range_end?: string;
  articles_found: number;
  articles_imported: number;
  articles_skipped: number;
  status: string;
  error_message?: string;
}

interface ImportLogsTableProps {
  logs: ImportLog[];
  isLoading: boolean;
}

export function ImportLogsTable({ logs, isLoading }: ImportLogsTableProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No import history found</p>
        <p className="text-sm">Start your first import to see logs here</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Found</TableHead>
            <TableHead>Imported</TableHead>
            <TableHead>Skipped</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const startDate = new Date(log.import_started_at);
            const endDate = log.import_completed_at ? new Date(log.import_completed_at) : null;
            const duration = endDate ? endDate.getTime() - startDate.getTime() : null;
            
            return (
              <TableRow key={log.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <Badge className={getStatusColor(log.status)}>
                      {log.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {log.date_range_start && log.date_range_end ? (
                    <div className="text-sm">
                      <div>{new Date(log.date_range_start).toLocaleDateString()}</div>
                      <div className="text-xs text-muted-foreground">
                        to {new Date(log.date_range_end).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {formatDistanceToNow(startDate, { addSuffix: true })}
                  </div>
                </TableCell>
                <TableCell>
                  {duration ? (
                    <span className="text-sm">
                      {Math.round(duration / 1000)}s
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{log.articles_found}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm text-green-600">{log.articles_imported}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm text-yellow-600">{log.articles_skipped}</span>
                </TableCell>
                <TableCell>
                  {log.error_message ? (
                    <div className="text-sm text-red-600 max-w-xs truncate" title={log.error_message}>
                      {log.error_message}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
