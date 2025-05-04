
import React from "react";
import { cn } from "@/lib/utils";
import { marked } from "marked";
import { Separator } from "@/components/ui/separator";

interface DocumentViewerProps {
  content: string;
  className?: string;
  title?: string;
  lastUpdated?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  content, 
  className,
  title,
  lastUpdated
}) => {
  // Parse markdown content
  const htmlContent = React.useMemo(() => {
    return { __html: marked.parse(content) };
  }, [content]);

  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          )}
          <Separator />
        </div>
      )}
      <div 
        className={cn(
          "prose prose-slate dark:prose-invert max-w-none",
          "prose-headings:font-semibold prose-headings:tracking-tight",
          "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
          "prose-blockquote:border-l-2 prose-blockquote:pl-4 prose-blockquote:italic",
          "prose-code:bg-muted prose-code:p-0.5 prose-code:rounded",
          "prose-img:rounded-md prose-img:shadow-sm",
          "prose-a:text-primary hover:prose-a:underline"
        )}
        dangerouslySetInnerHTML={htmlContent}
      />
    </div>
  );
};

export default DocumentViewer;
