
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ArticleApprovalProps {
  newsItem: {
    id: string;
    headline: string;
  };
  onApproved: () => void;
}

export default function ArticleApproval({ 
  newsItem, 
  onApproved
}: ArticleApprovalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  
  const toggleDestination = (destination: string) => {
    setSelectedDestinations(prev => 
      prev.includes(destination) 
        ? prev.filter(d => d !== destination) 
        : [...prev, destination]
    );
  };

  const handleApprove = async () => {
    if (selectedDestinations.length === 0) {
      toast.error("Please select at least one destination");
      return;
    }

    setIsProcessing(true);
    try {
      // Update the news item status in Supabase
      const { error: updateError } = await supabase
        .from('news')
        .update({ 
          status: 'approved',
          destinations: selectedDestinations
        })
        .eq('id', newsItem.id);
      
      if (updateError) throw updateError;
      
      // Create article entries for each approved destination
      for (const destination of selectedDestinations) {
        const { error: articleError } = await supabase
          .from('articles')
          .insert({
            title: newsItem.headline,
            source_news_id: newsItem.id,
            status: 'queued',
            destinations: [destination],
            content_variants: {
              summary: `This is a summary of article based on the news item: ${newsItem.headline}`
            }
          });
          
        if (articleError) {
          console.error(`Error creating article for ${destination}:`, articleError);
          toast.error(`Error creating article for ${destination}`);
        }
      }
      
      toast.success("Article approved for selected destinations");
      onApproved();
    } catch (err) {
      console.error("Error approving article:", err);
      toast.error("Failed to approve article");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = async () => {
    setIsProcessing(true);
    try {
      // Update the news item status in Supabase
      const { error: updateError } = await supabase
        .from('news')
        .update({ status: 'dismissed' })
        .eq('id', newsItem.id);
      
      if (updateError) throw updateError;
      
      toast.success("Article dismissed");
      onApproved();
    } catch (err) {
      console.error("Error dismissing article:", err);
      toast.error("Failed to dismiss article");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Destination selection */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="mpdaily" 
            checked={selectedDestinations.includes('mpdaily')}
            onCheckedChange={() => toggleDestination('mpdaily')} 
          />
          <Label htmlFor="mpdaily" className="cursor-pointer">MPDaily</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="website" 
            checked={selectedDestinations.includes('website')}
            onCheckedChange={() => toggleDestination('website')} 
          />
          <Label htmlFor="website" className="cursor-pointer">Website</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="magazine" 
            checked={selectedDestinations.includes('magazine')}
            onCheckedChange={() => toggleDestination('magazine')} 
          />
          <Label htmlFor="magazine" className="cursor-pointer">Magazine</Label>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2 w-full">
        <Button 
          variant="default" 
          className="flex-1"
          disabled={selectedDestinations.length === 0 || isProcessing}
          onClick={handleApprove}
        >
          <Send className="mr-1 h-4 w-4" />
          {isProcessing ? "Processing..." : "Approve"}
        </Button>
        <Button 
          variant="ghost" 
          className="flex-1"
          disabled={isProcessing}
          onClick={handleDismiss}
        >
          <X className="mr-1 h-4 w-4" />
          {isProcessing ? "Processing..." : "Dismiss"}
        </Button>
      </div>
    </div>
  );
}
