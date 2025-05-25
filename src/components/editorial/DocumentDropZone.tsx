
import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { file, upload } from "lucide-react";
import { processDocumentFile, ProcessedDocument } from "@/utils/documentProcessor";
import { toast } from "sonner";

interface DocumentDropZoneProps {
  onDocumentProcessed: (document: ProcessedDocument) => void;
  isProcessing: boolean;
}

export default function DocumentDropZone({ onDocumentProcessed, isProcessing }: DocumentDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

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

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      try {
        const processedDoc = await processDocumentFile(file);
        onDocumentProcessed(processedDoc);
        toast.success(`Successfully imported: ${file.name}`);
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error(error.message || `Failed to process ${file.name}`);
      }
    }
    
    // Reset input
    e.target.value = '';
  }, [onDocumentProcessed]);

  return (
    <Card
      className={`border-2 border-dashed p-8 text-center transition-colors ${
        isDragOver 
          ? 'border-primary bg-primary/5' 
          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
      } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-4">
        {isProcessing ? (
          <upload className="h-12 w-12 text-muted-foreground animate-pulse" />
        ) : (
          <file className="h-12 w-12 text-muted-foreground" />
        )}
        
        <div className="space-y-2">
          <h3 className="text-lg font-medium">
            {isProcessing ? 'Processing document...' : 'Import Document'}
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
                disabled={isProcessing}
              />
            </label>
          </p>
          <p className="text-xs text-muted-foreground">
            Supports: TXT, Markdown, HTML, Word, PDF
          </p>
        </div>
      </div>
    </Card>
  );
}
