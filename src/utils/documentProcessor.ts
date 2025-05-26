
import { supabase } from "@/integrations/supabase/client";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
    storageUrl?: string;
  };
}

export async function processDocumentFile(file: File): Promise<ProcessedDocument> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  let extractedContent = '';
  let title = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension
  
  console.log(`Processing file: ${file.name}, type: ${fileExtension}`);
  
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
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          extractedContent = result.value;
          console.log(`Extracted ${extractedContent.length} characters from DOCX file`);
        } catch (error) {
          console.error('Error extracting DOCX content:', error);
          throw new Error(`Failed to extract content from DOCX file: ${error.message}`);
        }
        break;
        
      case 'pdf':
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .filter((item: any) => 'str' in item)
              .map((item: any) => item.str)
              .join(' ');
            fullText += pageText + '\n';
          }
          
          extractedContent = fullText.trim();
          console.log(`Extracted ${extractedContent.length} characters from PDF file`);
        } catch (error) {
          console.error('Error extracting PDF content:', error);
          throw new Error(`Failed to extract content from PDF file: ${error.message}`);
        }
        break;
        
      default:
        throw new Error(`Unsupported file type: ${fileExtension}. Supported types: TXT, MD, HTML, DOCX, PDF`);
    }

    // Extract title from first line if it looks like a title (for text-based files)
    if (extractedContent && fileExtension !== 'docx' && fileExtension !== 'pdf') {
      const lines = extractedContent.split('\n').filter(line => line.trim());
      if (lines.length > 0 && lines[0].length < 100 && lines[0].length > 5) {
        title = lines[0].trim();
        extractedContent = lines.slice(1).join('\n').trim();
      }
    }

    // For DOCX and PDF, try to extract title from first line of content
    if ((fileExtension === 'docx' || fileExtension === 'pdf') && extractedContent) {
      const lines = extractedContent.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        // Use first line as title if it's not too long and looks like a title
        if (firstLine.length > 5 && firstLine.length < 100 && !firstLine.includes('.')) {
          title = firstLine;
          extractedContent = lines.slice(1).join('\n').trim();
        }
      }
    }

    // Ensure we have some content
    if (!extractedContent || extractedContent.trim().length === 0) {
      throw new Error(`No content could be extracted from ${file.name}. The file may be empty or corrupted.`);
    }

    // Upload file to storage (optional, for archival purposes)
    let storageUrl;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { data, error } = await supabase.storage
        .from('editorial-documents')
        .upload(filePath, file);

      if (!error) {
        storageUrl = filePath;
      }
    } catch (error) {
      console.warn('Failed to upload file to storage:', error);
      // Continue without storage - not critical for the workflow
    }

    console.log(`Successfully processed ${file.name}:`, {
      title,
      contentLength: extractedContent.length,
      storageUrl
    });

    return {
      title,
      content: extractedContent,
      type: "article",
      metadata: {
        originalFilename: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        storageUrl
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

// New function to directly create a draft from a processed document
export async function createDraftFromDocument(document: ProcessedDocument): Promise<any> {
  const newDraft = {
    title: document.title,
    theme: document.title,
    summary: document.content.substring(0, 200) + (document.content.length > 200 ? '...' : ''),
    outline: document.content,
    source_type: 'document',
    status: 'draft',
    content_variants: {
      editorial_content: {
        headline: document.title,
        summary: document.content.substring(0, 200) + (document.content.length > 200 ? '...' : ''),
        full_content: document.content,
        cta: "Read more..."
      },
      metadata: {
        seo_title: document.title,
        seo_description: document.content.substring(0, 160),
        tags: [],
        original_filename: document.metadata.originalFilename,
        storage_url: document.metadata.storageUrl
      },
      status: 'draft'
    },
    destinations: [],
    sources: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log("Creating editor brief from document:", newDraft);

  const { data, error } = await supabase
    .from('editor_briefs')
    .insert([newDraft])
    .select()
    .single();

  if (error) {
    console.error("Supabase error:", error);
    throw error;
  }

  console.log("Editor brief created successfully from document:", data);
  return data;
}
