
declare module 'mammoth' {
  interface ExtractRawTextOptions {
    arrayBuffer: ArrayBuffer;
  }
  
  interface ExtractRawTextResult {
    value: string;
    messages: any[];
  }
  
  export function extractRawText(options: ExtractRawTextOptions): Promise<ExtractRawTextResult>;
}

declare module 'pdfjs-dist' {
  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }
  
  interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
  }
  
  interface TextContent {
    items: TextItem[];
  }
  
  interface TextItem {
    str: string;
    [key: string]: any;
  }
  
  interface LoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }
  
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
  
  export const version: string;
  
  export function getDocument(src: { data: ArrayBuffer }): LoadingTask;
}
