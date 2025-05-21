
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import KeywordClustersTab from "@/components/keywords/KeywordClustersTab";
import KeywordTrackingTab from "@/components/keywords/KeywordTrackingTab";
import ClusterMaintenanceTab from "@/components/keywords/ClusterMaintenanceTab";
import PlanningTab from "@/components/keywords/PlanningTab";

const KeywordManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("clusters");
  const location = useLocation();
  const navigate = useNavigate();
  
  // Parse URL query parameter for tab selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['clusters', 'tracking', 'maintenance', 'planning'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);
  
  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    navigate(`?${url.searchParams.toString()}`, { replace: true });
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
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clusters">Manage Clusters</TabsTrigger>
          <TabsTrigger value="tracking">Keyword Analytics</TabsTrigger>
          <TabsTrigger value="maintenance">AI Suggestions</TabsTrigger>
          <TabsTrigger value="planning">Content Planning</TabsTrigger>
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
        
        <TabsContent value="planning" className="pt-4">
          <PlanningTab searchTerm={searchTerm} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default KeywordManagement;
