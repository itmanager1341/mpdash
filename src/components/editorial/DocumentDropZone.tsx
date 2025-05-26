
import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { File, Upload, AlertCircle } from "lucide-react";
import { processDocumentFile, ProcessedDocument } from "@/utils/documentProcessor";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DocumentDropZoneProps {
  onDocumentProcessed: (document: ProcessedDocument) => void;
  isProcessing: boolean;
}

export default function DocumentDropZone({ onDocumentProcessed, isProcessing }: DocumentDropZoneProps) {
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
        
        // Special handling for Word and PDF files
        if (fileExtension === 'docx' || fileExtension === 'pdf') {
          toast.success(`${file.name} imported - please paste the content manually`, {
            duration: 5000
          });
        } else {
          toast.success(`Successfully imported: ${file.name}`);
        }
        
        onDocumentProcessed(processedDoc);
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error(`Failed to process ${file.name}: ${error.message || 'Unknown error'}`);
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

      {/* Information about Word and PDF handling */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Note:</strong> Word (.docx) and PDF files will be imported with placeholder content. 
          You'll need to manually paste or type the actual content in the editor after import.
        </AlertDescription>
      </Alert>
    </div>
  );
}
