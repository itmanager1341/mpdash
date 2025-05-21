
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Filter, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import KeywordClustersTab from "@/components/keywords/KeywordClustersTab";
import KeywordTrackingTab from "@/components/keywords/KeywordTrackingTab";
import ClusterMaintenanceTab from "@/components/keywords/ClusterMaintenanceTab";

const KeywordManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("clusters");
  const queryClient = useQueryClient();

  // Generate AI suggestions for keywords/clusters
  const generateSuggestions = async () => {
    try {
      toast.info("Analyzing content and generating keyword suggestions...");
      
      const { data, error } = await supabase.functions.invoke('suggest-keywords', {
        body: { source: "news_analysis" }
      });
      
      if (error) throw error;
      
      if (data?.suggestions) {
        toast.success(`Generated ${data.suggestions.length} keyword suggestions`);
        // Refresh the data after generating suggestions
        queryClient.invalidateQueries({ queryKey: ['keyword-clusters'] });
        queryClient.invalidateQueries({ queryKey: ['keyword-tracking'] });
      }
    } catch (err) {
      console.error("Error generating suggestions:", err);
      toast.error("Failed to generate keyword suggestions");
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Keyword Management</h1>
        <p className="text-muted-foreground">
          Manage keyword clusters, track performance, and maintain your editorial taxonomy
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={generateSuggestions}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI Suggestions
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clusters">Keyword Clusters</TabsTrigger>
          <TabsTrigger value="tracking">Tracking & Analytics</TabsTrigger>
          <TabsTrigger value="maintenance">Cluster Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="clusters" className="pt-4">
          <KeywordClustersTab searchTerm={searchTerm} />
        </TabsContent>

        <TabsContent value="tracking" className="pt-4">
          <KeywordTrackingTab searchTerm={searchTerm} />
        </TabsContent>

        <TabsContent value="maintenance" className="pt-4">
          <ClusterMaintenanceTab searchTerm={searchTerm} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default KeywordManagement;
