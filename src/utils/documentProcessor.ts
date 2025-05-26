
import { supabase } from "@/integrations/supabase/client";

export interface ProcessedDocument {
  title: string;
  content: string;
  type: string;
  metadata: {
    originalFilename: string;
    fileSize: number;
    uploadedAt: string;
    author?: string;
    createdDate?: string;
    needsManualContent?: boolean;
    processingNotes?: string;
  };
}

export async function processDocumentFile(file: File): Promise<ProcessedDocument> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  let extractedContent = '';
  let title = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension
  let needsManualContent = false;
  let processingNotes = '';
  
  console.log(`Processing file: ${file.name}, type: ${fileExtension}`);
  
  try {
    switch (fileExtension) {
      case 'txt':
      case 'md':
        extractedContent = await file.text();
        processingNotes = 'Text content successfully extracted';
        break;
        
      case 'html':
        const htmlContent = await file.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        extractedContent = tempDiv.textContent || tempDiv.innerText || '';
        processingNotes = 'HTML content converted to plain text';
        break;
        
      case 'docx':
        needsManualContent = true;
        extractedContent = `[Word Document: ${file.name}]

This document was imported from a Word file. Please paste the actual content below:

1. Open your Word document
2. Select all content (Ctrl+A / Cmd+A)
3. Copy the content (Ctrl+C / Cmd+C) 
4. Replace this placeholder text with your content

File Details:
- Original filename: ${file.name}
- File size: ${(file.size / 1024).toFixed(1)} KB
- Imported: ${new Date().toLocaleString()}`;
        processingNotes = 'Word document imported - manual content entry required';
        break;
        
      case 'pdf':
        needsManualContent = true;
        extractedContent = `[PDF Document: ${file.name}]

This document was imported from a PDF file. Please paste the actual content below:

1. Open your PDF document
2. Select and copy the text content
3. Replace this placeholder text with your content

Note: For best results, ensure the PDF contains selectable text (not scanned images).

File Details:
- Original filename: ${file.name}
- File size: ${(file.size / 1024).toFixed(1)} KB
- Imported: ${new Date().toLocaleString()}`;
        processingNotes = 'PDF document imported - manual content entry required';
        break;
        
      default:
        throw new Error(`Unsupported file type: ${fileExtension}. Supported types: TXT, MD, HTML, DOCX, PDF`);
    }

    // Extract title from first line if it looks like a title
    if (!needsManualContent) {
      const lines = extractedContent.split('\n').filter(line => line.trim());
      if (lines.length > 0 && lines[0].length < 100 && lines[0].length > 5) {
        title = lines[0].trim();
        extractedContent = lines.slice(1).join('\n').trim();
      }
    }

    console.log(`Successfully processed ${file.name}:`, {
      title,
      contentLength: extractedContent.length,
      needsManualContent,
      processingNotes
    });

    return {
      title,
      content: extractedContent,
      type: "article",
      metadata: {
        originalFilename: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        needsManualContent,
        processingNotes
      }
    };
  } catch (error) {
    console.error('Error processing document:', error);
    throw new Error(`Failed to process ${file.name}: ${error.message}`);
  }
}

export async function uploadDocumentToStorage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `documents/${fileName}`;

  const { data, error } = await supabase.storage
    .from('editorial-documents')
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return data.path;
}
