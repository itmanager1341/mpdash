
import { useCallback, useState } from "react";
import { ProcessedDocument, processDocumentFile } from "@/utils/documentProcessor";
import { toast } from "sonner";
import DocumentDropZone from "./DocumentDropZone";

interface WorkspaceDropZoneProps {
  children: React.ReactNode;
  onDocumentProcessed: (document: ProcessedDocument) => void;
  isProcessing: boolean;
  processedFiles?: ProcessedDocument[];
  onFileDelete?: (index: number) => void;
}

export default function WorkspaceDropZone({ 
  children, 
  onDocumentProcessed, 
  isProcessing,
  processedFiles,
  onFileDelete
}: WorkspaceDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only hide overlay if leaving the workspace entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    
    if (files.length === 0) return;

    console.log("Files dropped in workspace:", files);

    for (const file of files) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const supportedTypes = ['txt', 'md', 'html', 'docx', 'pdf'];
      
      if (!supportedTypes.includes(fileExtension || '')) {
        toast.error(`Unsupported file type: ${file.name}. Supported types: TXT, Markdown, HTML, Word, PDF`);
        continue;
      }

      try {
        const processedDoc = await processDocumentFile(file);
        onDocumentProcessed(processedDoc);
        
        if (fileExtension === 'docx' || fileExtension === 'pdf') {
          toast.success(`${file.name} imported - content needs manual entry`, {
            duration: 4000
          });
        } else {
          toast.success(`Successfully imported: ${file.name}`);
        }
      } catch (error) {
        console.error("Error processing file:", error);
        toast.error(`Failed to process ${file.name}: ${error.message || 'Unknown error'}`);
      }
    }
  }, [onDocumentProcessed]);

  return (
    <div 
      className="h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      
      {/* File Management Overlay */}
      {(processedFiles && processedFiles.length > 0) && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <DocumentDropZone
            onDocumentProcessed={onDocumentProcessed}
            isProcessing={isProcessing}
            processedFiles={processedFiles}
            onFileDelete={onFileDelete}
          />
        </div>
      )}
      
      {/* Drag Overlay */}
      {isDragOver && !isProcessing && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-40 flex items-center justify-center">
          <div className="bg-background rounded-lg p-8 shadow-lg text-center">
            <div className="text-4xl mb-4">📁</div>
            <h3 className="text-xl font-semibold mb-2">Drop files to import</h3>
            <p className="text-muted-foreground">
              Supports TXT, Markdown, HTML, Word, and PDF files
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
