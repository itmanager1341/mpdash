
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Calendar } from "lucide-react";

interface ArticleApprovalProps {
  newsItem: {
    id: string;
    headline: string;
  };
  onApproved: () => void;
  approvalCount: number;
  setApprovalCount: (count: number) => void;
}

export default function ArticleApproval({ 
  newsItem, 
  onApproved, 
  approvalCount, 
  setApprovalCount 
}: ArticleApprovalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const generateContentWithOpenAI = async (newsItemId: string, target: 'mpdaily' | 'magazine') => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-article', {
        body: { newsItemId, target }
      });
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error generating content:", err);
      throw err;
    }
  };

  const handleApproveForDaily = async () => {
    if (approvalCount >= 5) {
      toast.error("Maximum daily approval limit reached (5)");
      return;
    }

    setIsProcessing(true);
    try {
      // Update the news item status in Supabase
      const { error: updateError } = await supabase
        .from('news')
        .update({ status: 'queued_mpdaily' })
        .eq('id', newsItem.id);
      
      if (updateError) throw updateError;
      
      // Generate content with OpenAI
      await generateContentWithOpenAI(newsItem.id, 'mpdaily');
      
      // Increment approval count
      const newCount = approvalCount + 1;
      setApprovalCount(newCount);
      localStorage.setItem('approvalCount', newCount.toString());
      
      toast.success("Article approved for MPDaily");
      onApproved();
    } catch (err) {
      console.error("Error approving article:", err);
      toast.error("Failed to approve article");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRouteToMagazine = async () => {
    setIsProcessing(true);
    try {
      // Update the news item status in Supabase
      const { error: updateError } = await supabase
        .from('news')
        .update({ status: 'queued_magazine' })
        .eq('id', newsItem.id);
      
      if (updateError) throw updateError;
      
      // Generate content with OpenAI
      await generateContentWithOpenAI(newsItem.id, 'magazine');
      
      toast.success("Article routed to Magazine Planner");
      onApproved();
    } catch (err) {
      console.error("Error routing article:", err);
      toast.error("Failed to route article");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex gap-2 w-full">
      <Button 
        variant="default" 
        className="flex-1"
        disabled={approvalCount >= 5 || isProcessing}
        onClick={handleApproveForDaily}
      >
        <Send className="mr-1 h-4 w-4" />
        {isProcessing ? "Processing..." : "Approve"}
      </Button>
      <Button 
        variant="outline" 
        className="flex-1"
        disabled={isProcessing}
        onClick={handleRouteToMagazine}
      >
        <Calendar className="mr-1 h-4 w-4" />
        {isProcessing ? "Processing..." : "Magazine"}
      </Button>
    </div>
  );
}
