
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface DraftPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  headline: string;
  summary: string;
  content: string;
}

export default function DraftPreviewModal({
  open,
  onOpenChange,
  title,
  headline,
  summary,
  content
}: DraftPreviewModalProps) {
  
  const handleCopyContent = () => {
    const fullContent = `${headline}\n\n${summary}\n\n${content}`;
    navigator.clipboard.writeText(fullContent);
    toast.success("Content copied to clipboard");
  };

  const formatContentForPreview = (text: string) => {
    return text.split('\n').map((paragraph, index) => (
      <p key={index} className="mb-4">{paragraph}</p>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Article Preview</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyContent}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="mt-6">
          {/* Article Preview */}
          <article className="prose max-w-none">
            {headline && (
              <h1 className="text-3xl font-bold mb-4 text-gray-900">
                {headline}
              </h1>
            )}
            
            {summary && (
              <div className="text-lg text-gray-600 mb-6 italic border-l-4 border-blue-500 pl-4">
                {summary}
              </div>
            )}
            
            {content ? (
              <div className="text-gray-800 leading-relaxed">
                {formatContentForPreview(content)}
              </div>
            ) : (
              <div className="text-gray-400 italic">
                No content available
              </div>
            )}
          </article>
          
          {/* Meta Information */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Article Metadata</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Title:</span>
                <p className="text-gray-600">{title || "No title"}</p>
              </div>
              <div>
                <span className="font-medium">Word Count:</span>
                <p className="text-gray-600">{Math.round(content.length / 5)} words</p>
              </div>
              <div>
                <span className="font-medium">Character Count:</span>
                <p className="text-gray-600">{content.length} characters</p>
              </div>
              <div>
                <span className="font-medium">Reading Time:</span>
                <p className="text-gray-600">{Math.ceil(content.length / 1000)} minutes</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
