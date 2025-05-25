
import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileText } from "lucide-react";
import { processDocumentFile, ProcessedDocument } from "@/utils/documentProcessor";
import { toast } from "sonner";

interface WorkspaceDropZoneProps {
  onDocumentProcessed: (document: ProcessedDocument) => void;
  children: React.ReactNode;
  isProcessing: boolean;
}

export default function WorkspaceDropZone({ 
  onDocumentProcessed, 
  children, 
  isProcessing 
}: WorkspaceDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer?.types.includes('Files')) {
      setDragCounter(prev => prev + 1);
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter <= 0) {
        setIsDragOver(false);
        return 0;
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragOver(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer?.files || []);
    const supportedTypes = ['txt', 'md', 'html', 'docx', 'pdf'];
    
    for (const file of files) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!supportedTypes.includes(fileExtension || '')) {
        toast.error(`Unsupported file type: ${file.name}`);
        continue;
      }

      try {
        const processedDoc = await processDocumentFile(file);
        onDocumentProcessed(processedDoc);
        toast.success(`Successfully imported: ${file.name}`);
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error(error.message || `Failed to process ${file.name}`);
      }
    }
  }, [onDocumentProcessed]);

  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
      dropZone.removeEventListener('dragenter', handleDragEnter);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return (
    <div ref={dropZoneRef} className="relative h-full w-full">
      {children}
      
      {/* Drop Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="border-2 border-dashed border-primary bg-background/95 rounded-lg p-12 text-center max-w-md mx-4 shadow-lg">
            <div className="flex flex-col items-center gap-6">
              {isProcessing ? (
                <Upload className="h-16 w-16 text-primary animate-pulse" />
              ) : (
                <FileText className="h-16 w-16 text-primary" />
              )}
              
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-primary">
                  {isProcessing ? 'Processing...' : 'Drop files here'}
                </h3>
                <p className="text-muted-foreground">
                  {isProcessing 
                    ? 'Please wait while we process your documents'
                    : 'Release to create new drafts from your documents'
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports: TXT, Markdown, HTML, Word, PDF
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
