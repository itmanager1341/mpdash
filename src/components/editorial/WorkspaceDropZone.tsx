
import { useCallback, useState } from "react";
import { processDocumentFile, createDraftFromDocument } from "@/utils/documentProcessor";
import { toast } from "sonner";

interface WorkspaceDropZoneProps {
  children: React.ReactNode;
  onDraftCreated: (draft: any) => void;
  isProcessing: boolean;
}

export default function WorkspaceDropZone({ 
  children, 
  onDraftCreated, 
  isProcessing
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
        toast.loading(`Processing ${file.name}...`, { id: file.name });
        
        // Process the document
        const processedDoc = await processDocumentFile(file);
        
        // Directly create a draft from the processed document
        const newDraft = await createDraftFromDocument(processedDoc);
        
        // Notify parent component
        onDraftCreated(newDraft);
        
        toast.success(`Draft created from ${file.name}`, { id: file.name });
        
        if (fileExtension === 'docx' || fileExtension === 'pdf') {
          toast.info(`${file.name} imported - you can now edit the content in the draft editor`, {
            duration: 4000
          });
        }
      } catch (error) {
        console.error("Error processing file:", error);
        toast.error(`Failed to process ${file.name}: ${error.message || 'Unknown error'}`, { id: file.name });
      }
    }
  }, [onDraftCreated]);

  return (
    <div 
      className="h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      
      {/* Drag Overlay */}
      {isDragOver && !isProcessing && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-40 flex items-center justify-center">
          <div className="bg-background rounded-lg p-8 shadow-lg text-center">
            <div className="text-4xl mb-4">📁</div>
            <h3 className="text-xl font-semibold mb-2">Drop files to create drafts</h3>
            <p className="text-muted-foreground">
              Supports TXT, Markdown, HTML, Word, and PDF files
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Files will be automatically processed and saved as drafts
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
