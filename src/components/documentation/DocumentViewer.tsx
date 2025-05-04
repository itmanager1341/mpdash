
import React from "react";
import { cn } from "@/lib/utils";
import { marked } from "marked";

interface DocumentViewerProps {
  content: string;
  className?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ content, className }) => {
  // Parse markdown content
  const htmlContent = React.useMemo(() => {
    return { __html: marked.parse(content) };
  }, [content]);

  return (
    <div 
      className={cn(
        "prose prose-slate dark:prose-invert max-w-none",
        className
      )}
      dangerouslySetInnerHTML={htmlContent}
    />
  );
};

export default DocumentViewer;
