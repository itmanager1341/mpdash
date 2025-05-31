import { supabase } from "@/integrations/supabase/client";
import { extractCleanContent, generateContentHash, calculateWordCount } from "./wordCountUtils";

// Dynamic imports for better compatibility in Vite/Lovable environment
let mammoth: any;
let pdfjs: any;

// Initialize packages dynamically
const initializePackages = async () => {
  try {
    if (!mammoth) {
      mammoth = await import('mammoth');
    }
    if (!pdfjs) {
      pdfjs = await import('pdfjs-dist');
      // Configure PDF.js worker
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    }
  } catch (error) {
    console.warn('Failed to load document processing packages:', error);
  }
};

export interface ProcessedDocument {
  title: string;
  content: string;
  cleanContent: string;
  contentHash: string;
  wordCount: number;
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
  // Initialize packages before processing
  await initializePackages();
  
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  let extractedContent = '';
  // Always use filename (without extension) as title - no fancy extraction
  const title = file.name.replace(/\.[^/.]+$/, "");
  
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
        if (!mammoth) {
          throw new Error('DOCX processing is not available - mammoth package failed to load');
        }
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
        if (!pdfjs) {
          throw new Error('PDF processing is not available - pdfjs-dist package failed to load');
        }
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

    // Ensure we have some content
    if (!extractedContent || extractedContent.trim().length === 0) {
      throw new Error(`No content could be extracted from ${file.name}. The file may be empty or corrupted.`);
    }

    // Clean the content and calculate metrics
    const cleanContent = extractedContent.trim();
    const contentHash = generateContentHash(cleanContent);
    const wordCount = calculateWordCount(cleanContent);

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
      wordCount,
      storageUrl
    });

    return {
      title,
      content: extractedContent,
      cleanContent,
      contentHash,
      wordCount,
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

// Updated draft creation to use clean_content field
export async function createDraftFromDocument(document: ProcessedDocument): Promise<any> {
  const newDraft = {
    title: document.title,
    theme: document.title,
    summary: '',
    outline: document.content,
    source_type: 'document',
    status: 'draft',
    content_variants: {
      editorial_content: {
        headline: '',
        summary: '',
        full_content: document.content,
        cta: ''
      },
      metadata: {
        seo_title: document.title,
        seo_description: '',
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

// Function to extract and populate clean_content for existing articles
export async function extractCleanContentForArticle(articleId: string): Promise<boolean> {
  try {
    // Fetch the article
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (fetchError) {
      console.error('Error fetching article:', fetchError);
      return false;
    }

    // Extract clean content using the simplified function
    const cleanContent = extractCleanContent(article);
    const contentHash = generateContentHash(cleanContent);
    const wordCount = calculateWordCount(cleanContent);

    // Update the article with clean content, hash, and word count
    const { error: updateError } = await supabase
      .from('articles')
      .update({
        clean_content: cleanContent,
        content_hash: contentHash,
        word_count: wordCount
      })
      .eq('id', articleId);

    if (updateError) {
      console.error('Error updating article with clean content:', updateError);
      return false;
    }

    console.log(`Successfully extracted clean content for article ${articleId}: ${wordCount} words`);
    return true;
  } catch (error) {
    console.error('Error in extractCleanContentForArticle:', error);
    return false;
  }
}
