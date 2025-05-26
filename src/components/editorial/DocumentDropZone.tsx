
import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { File, Upload, AlertCircle, Trash2, X } from "lucide-react";
import { processDocumentFile, ProcessedDocument } from "@/utils/documentProcessor";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface DocumentDropZoneProps {
  onDocumentProcessed: (document: ProcessedDocument) => void;
  isProcessing: boolean;
  processedFiles?: ProcessedDocument[];
  onFileDelete?: (index: number) => void;
}

export default function DocumentDropZone({ 
  onDocumentProcessed, 
  isProcessing,
  processedFiles = [],
  onFileDelete 
}: DocumentDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [draggedFileIndex, setDraggedFileIndex] = useState<number | null>(null);

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

  const handleFileDelete = (index: number, fileName: string) => {
    console.log(`Attempting to delete file at index ${index}: ${fileName}`);
    
    if (onFileDelete) {
      try {
        onFileDelete(index);
        toast.success(`Removed ${fileName} from workspace`);
        console.log(`Successfully deleted file: ${fileName}`);
      } catch (error) {
        console.error('Error deleting file:', error);
        toast.error(`Failed to remove ${fileName}`);
      }
    } else {
      console.error('onFileDelete function not provided');
      toast.error('Delete function not available');
    }
  };

  const handleFileDragStart = (e: React.DragEvent, index: number) => {
    console.log(`Starting drag for file at index: ${index}`);
    setDraggedFileIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleFileDragEnd = () => {
    console.log('Ending file drag');
    setDraggedFileIndex(null);
    setDragOverTrash(false);
  };

  const handleTrashDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTrash(true);
    console.log('Dragging over trash');
  };

  const handleTrashDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTrash(false);
    console.log('Left trash area');
  };

  const handleTrashDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTrash(false);
    
    const draggedIndex = draggedFileIndex;
    console.log(`Dropping file at index ${draggedIndex} on trash`);
    
    if (draggedIndex !== null && processedFiles[draggedIndex]) {
      const fileName = processedFiles[draggedIndex].title;
      handleFileDelete(draggedIndex, fileName);
    } else {
      console.error('No valid file index for deletion');
      toast.error('Could not identify file to delete');
    }
    
    setDraggedFileIndex(null);
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
            {processedFiles.map((file, index) => (
              <Card 
                key={`${file.title}-${index}`} 
                className="p-3 cursor-move hover:bg-muted/50 transition-colors border"
                draggable
                onDragStart={(e) => handleFileDragStart(e, index)}
                onDragEnd={handleFileDragEnd}
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
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Drag and Drop Trash Can */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
              dragOverTrash 
                ? 'border-red-500 bg-red-50 text-red-700' 
                : 'border-red-300 bg-red-50/30 text-red-500 hover:border-red-400'
            }`}
            onDragOver={handleTrashDragOver}
            onDragLeave={handleTrashDragLeave}
            onDrop={handleTrashDrop}
          >
            <Trash2 className={`h-8 w-8 mx-auto mb-2 ${dragOverTrash ? 'animate-bounce' : ''}`} />
            <p className="text-sm font-medium">
              {dragOverTrash ? 'Drop to delete file' : 'Drag files here to delete'}
            </p>
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
