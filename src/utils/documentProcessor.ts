
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
  };
}

export async function processDocumentFile(file: File): Promise<ProcessedDocument> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  let extractedContent = '';
  let title = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension
  
  try {
    switch (fileExtension) {
      case 'txt':
      case 'md':
        extractedContent = await file.text();
        break;
      case 'html':
        const htmlContent = await file.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        extractedContent = tempDiv.textContent || tempDiv.innerText || '';
        break;
      case 'docx':
        // For now, we'll prompt the user to copy-paste content
        // In a production environment, you'd use a library like mammoth.js
        extractedContent = `[Word document imported: ${file.name}]\n\nPlease paste the content below:`;
        break;
      case 'pdf':
        // For now, we'll prompt the user to copy-paste content
        // In a production environment, you'd use a PDF parsing library
        extractedContent = `[PDF document imported: ${file.name}]\n\nPlease paste the content below:`;
        break;
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    // Extract title from first line if it looks like a title
    const lines = extractedContent.split('\n').filter(line => line.trim());
    if (lines.length > 0 && lines[0].length < 100) {
      title = lines[0].trim();
      extractedContent = lines.slice(1).join('\n');
    }

    return {
      title,
      content: extractedContent,
      type: "article",
      metadata: {
        originalFilename: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
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
