import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { File, Upload, AlertCircle, Trash2 } from "lucide-react";
import { processDocumentFile, ProcessedDocument } from "@/utils/documentProcessor";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface DocumentDropZoneProps {
  onDocumentProcessed: (document: ProcessedDocument) => void;
  isProcessing: boolean;
  processedFiles?: ProcessedDocument[];
  onFileDelete?: (index: number) => void;
  onDraftDeleted?: () => void; // New prop for when drafts are deleted
}

export default function DocumentDropZone({ 
  onDocumentProcessed, 
  isProcessing,
  processedFiles = [],
  onFileDelete,
  onDraftDeleted
}: DocumentDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);
  const [deletingFiles, setDeletingFiles] = useState<string[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, [onDocumentProcessed]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    
    // Reset input
    e.target.value = '';
  }, [onDocumentProcessed]);

  const processFiles = async (files: File[]) => {
    const supportedTypes = ['txt', 'md', 'html', 'docx', 'pdf'];
    
    for (const file of files) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!supportedTypes.includes(fileExtension || '')) {
        toast.error(`Unsupported file type: ${file.name}. Supported types: TXT, Markdown, HTML, Word, PDF`);
        continue;
      }

      setProcessingFiles(prev => [...prev, file.name]);

      try {
        console.log(`Processing file: ${file.name}`);
        const processedDoc = await processDocumentFile(file);
        
        toast.success(`Successfully imported: ${file.name}`);
        onDocumentProcessed(processedDoc);
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error(`Failed to process ${file.name}: ${error.message || 'Unknown error'}`);
      } finally {
        setProcessingFiles(prev => prev.filter(name => name !== file.name));
      }
    }
  };

  const handleFileDelete = async (index: number, fileName: string) => {
    console.log(`Delete button clicked for file at index ${index}: ${fileName}`);
    
    // Check if this is a draft that was created from a document
    const file = processedFiles[index];
    if (!file) {
      toast.error('File not found');
      return;
    }

    setDeletingFiles(prev => [...prev, fileName]);

    try {
      // If this was a processed document, we need to find and delete the corresponding draft
      const { data: drafts, error: fetchError } = await supabase
        .from('editor_briefs')
        .select('id, title')
        .eq('title', fileName)
        .eq('source_type', 'document');

      if (fetchError) {
        console.error('Error fetching draft:', fetchError);
        throw new Error('Failed to find draft');
      }

      if (drafts && drafts.length > 0) {
        // Delete the draft from the database
        const { error: deleteError } = await supabase
          .from('editor_briefs')
          .delete()
          .eq('id', drafts[0].id);

        if (deleteError) {
          console.error('Error deleting draft:', deleteError);
          throw new Error('Failed to delete draft');
        }

        console.log(`Successfully deleted draft: ${fileName}`);
        toast.success(`Deleted ${fileName} and its draft`);
        
        // Notify parent components
        if (onDraftDeleted) {
          onDraftDeleted();
        }
        if (onFileDelete) {
          onFileDelete(index);
        }
      } else {
        // Fallback to local deletion if no draft found
        if (onFileDelete) {
          onFileDelete(index);
          toast.success(`Removed ${fileName} from list`);
        } else {
          throw new Error('No delete function available');
        }
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error(`Failed to delete ${fileName}: ${error.message}`);
    } finally {
      setDeletingFiles(prev => prev.filter(name => name !== fileName));
    }
  };

  const isFileProcessing = processingFiles.length > 0 || isProcessing;

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed p-8 text-center transition-colors ${
          isDragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        } ${isFileProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4">
          {isFileProcessing ? (
            <Upload className="h-12 w-12 text-muted-foreground animate-pulse" />
          ) : (
            <File className="h-12 w-12 text-muted-foreground" />
          )}
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">
              {isFileProcessing ? 'Processing document...' : 'Import Document'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Drag & drop files here or{' '}
              <label className="text-primary cursor-pointer hover:underline">
                browse files
                <input
                  type="file"
                  multiple
                  accept=".txt,.md,.html,.docx,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isFileProcessing}
                />
              </label>
            </p>
            <p className="text-xs text-muted-foreground">
              Supports: TXT, Markdown, HTML, Word, PDF
            </p>
            
            {processingFiles.length > 0 && (
              <div className="text-xs text-blue-600">
                Processing: {processingFiles.join(', ')}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Processed Files List */}
      {processedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Imported Files ({processedFiles.length}):</h4>
          <div className="space-y-2">
            {processedFiles.map((file, index) => {
              const isDeleting = deletingFiles.includes(file.title);
              return (
                <Card 
                  key={`${file.title}-${index}`} 
                  className={`p-3 border hover:bg-muted/50 transition-colors ${isDeleting ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{file.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.metadata.originalFilename} • {(file.metadata.fileSize / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log(`Delete button clicked for file: ${file.title}`);
                        handleFileDelete(index, file.title);
                      }}
                      disabled={isDeleting}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                    >
                      {isDeleting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Updated information about file handling */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Note:</strong> All supported file types (TXT, Markdown, HTML, Word, PDF) will have their content extracted automatically and saved as drafts ready for editing.
        </AlertDescription>
      </Alert>
    </div>
  );
}
