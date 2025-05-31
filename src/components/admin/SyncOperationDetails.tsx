
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle, 
  Undo2,
  ExternalLink,
  FileText,
  RefreshCw,
  Users
} from "lucide-react";
import { format } from "date-fns";

interface SyncOperationDetailsProps {
  operation: {
    id: string;
    operation_type: string;
    status: string;
    created_at: string;
    updated_at: string;
    total_items: number;
    completed_items: number;
    results_summary?: any;
    error_details?: any[];
    merge_decisions?: any[];
  };
  onRefresh: () => void;
}

export function SyncOperationDetails({ operation, onRefresh }: SyncOperationDetailsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [undoingMerge, setUndoingMerge] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleUndoMerge = async (mergeDecision: any) => {
    setUndoingMerge(mergeDecision.id);
    
    try {
      // This would need to be implemented as an edge function
      // For now, we'll show a placeholder
      toast.error("Undo merge functionality needs to be implemented");
      
      // TODO: Implement undo merge edge function that:
      // 1. Restores the deleted article from backup data
      // 2. Clears the WordPress ID from the kept article
      // 3. Updates the merge decision to mark it as undone
      
    } catch (error) {
      console.error('Error undoing merge:', error);
      toast.error('Failed to undo merge');
    } finally {
      setUndoingMerge(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case 'running':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Running</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'wordpress_import':
        return <ExternalLink className="h-4 w-4" />;
      case 'selected_article_sync':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const summary = operation.results_summary || {};
  const errorDetails = operation.error_details || [];
  const mergeDecisions = operation.merge_decisions || [];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getOperationIcon(operation.operation_type)}
            <CardTitle className="text-lg">
              {operation.operation_type === 'wordpress_import' ? 'WordPress Import' : 'Article Sync'}
            </CardTitle>
            {getStatusBadge(operation.status)}
          </div>
          <div className="text-sm text-muted-foreground">
            {format(new Date(operation.created_at), 'MMM d, yyyy h:mm a')}
          </div>
        </div>
        <CardDescription>
          Processed {operation.completed_items} of {operation.total_items} items
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        {Object.keys(summary).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-2 bg-blue-50 rounded-md">
              <div className="text-2xl font-bold text-blue-600">{summary.processed || 0}</div>
              <div className="text-xs text-blue-700">Processed</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-md">
              <div className="text-2xl font-bold text-green-600">{summary.updated || 0}</div>
              <div className="text-xs text-green-700">Updated</div>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded-md">
              <div className="text-2xl font-bold text-purple-600">{summary.merged || 0}</div>
              <div className="text-xs text-purple-700">Merged</div>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-md">
              <div className="text-2xl font-bold text-red-600">{summary.total_errors || 0}</div>
              <div className="text-xs text-red-700">Errors</div>
            </div>
          </div>
        )}

        {/* Merge Decisions Section */}
        {mergeDecisions.length > 0 && (
          <Collapsible 
            open={expandedSections.has('merges')} 
            onOpenChange={() => toggleSection('merges')}
          >
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <div className="flex items-center gap-2">
                  {expandedSections.has('merges') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Merged Articles ({mergeDecisions.length})</span>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {mergeDecisions.map((merge, index) => (
                <Alert key={merge.id || index} className="border-purple-200 bg-purple-50">
                  <Users className="h-4 w-4" />
                  <AlertTitle>Automatic Merge</AlertTitle>
                  <AlertDescription className="mt-2">
                    <div className="space-y-2">
                      <div>
                        <strong>Deleted:</strong> "{merge.deletedArticle?.title}" (ID: {merge.deletedArticle?.id})
                      </div>
                      <div>
                        <strong>Kept:</strong> "{merge.keptArticle?.title}" (ID: {merge.keptArticle?.id})
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>Reason:</strong> {merge.reason}
                      </div>
                      {merge.canUndo && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUndoMerge(merge)}
                          disabled={undoingMerge === merge.id}
                          className="mt-2"
                        >
                          {undoingMerge === merge.id ? (
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Undo2 className="h-3 w-3 mr-1" />
                          )}
                          Undo Merge
                        </Button>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Error Details Section */}
        {errorDetails.length > 0 && (
          <Collapsible 
            open={expandedSections.has('errors')} 
            onOpenChange={() => toggleSection('errors')}
          >
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <div className="flex items-center gap-2">
                  {expandedSections.has('errors') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="font-medium">Errors ({errorDetails.length})</span>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {errorDetails.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{error.errorType?.replace('_', ' ').toUpperCase() || 'Error'}</AlertTitle>
                  <AlertDescription className="mt-2">
                    <div className="space-y-1">
                      <div><strong>Article:</strong> "{error.articleTitle}" (ID: {error.articleId})</div>
                      <div><strong>Error:</strong> {error.error}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(error.timestamp), 'h:mm:ss a')}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Success Message */}
        {operation.status === 'completed' && errorDetails.length === 0 && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Sync Completed Successfully</AlertTitle>
            <AlertDescription className="text-green-700">
              All articles were processed without errors.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
