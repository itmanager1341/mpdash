import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { File, Upload, AlertCircle } from "lucide-react";
import { processDocumentFile, ProcessedDocument } from "@/utils/documentProcessor";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DocumentDropZoneProps {
  onDocumentProcessed: (document: ProcessedDocument) => void;
  isProcessing: boolean;
  processedFiles?: ProcessedDocument[];
}

export default function DocumentDropZone({ 
  onDocumentProcessed, 
  isProcessing,
  processedFiles = []
}: DocumentDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);

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
        
        // Provide more specific error messages
        if (error.message.includes('mammoth package failed to load')) {
          toast.error(`DOCX processing unavailable for ${file.name}. Try TXT, Markdown, or HTML files instead.`);
        } else if (error.message.includes('pdfjs-dist package failed to load')) {
          toast.error(`PDF processing unavailable for ${file.name}. Try TXT, Markdown, or HTML files instead.`);
        } else {
          toast.error(`Failed to process ${file.name}: ${error.message || 'Unknown error'}`);
        }
      } finally {
        setProcessingFiles(prev => prev.filter(name => name !== file.name));
      }
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

      {/* Processed Files List - Display Only */}
      {processedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Recently Imported Files ({processedFiles.length}):</h4>
          <div className="space-y-2">
            {processedFiles.map((file, index) => (
              <Card 
                key={`${file.title}-${index}`} 
                className="p-3 border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.metadata.originalFilename} • {(file.metadata.fileSize / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            💡 To delete imported documents, find them in your drafts list and use the delete option.
          </p>
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
