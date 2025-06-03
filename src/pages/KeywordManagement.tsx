
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import KeywordClustersTab from "@/components/keywords/KeywordClustersTab";
import KeywordTrackingTab from "@/components/keywords/KeywordTrackingTab";
import SearchPromptsTab from "@/components/keywords/SearchPromptsTab";

const KeywordManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("clusters");
  const location = useLocation();
  const navigate = useNavigate();
  
  // Parse URL query parameter for tab selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['clusters', 'tracking', 'search-prompts'].includes(tabParam)) {
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
          Manage keyword clusters, track performance, and configure news search prompts
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clusters">Manage Clusters</TabsTrigger>
          <TabsTrigger value="tracking">Keyword Analytics</TabsTrigger>
          <TabsTrigger value="search-prompts">Search Prompts</TabsTrigger>
        </TabsList>

        <TabsContent value="clusters" className="pt-4">
          <KeywordClustersTab searchTerm={searchTerm} />
        </TabsContent>

        <TabsContent value="tracking" className="pt-4">
          <KeywordTrackingTab searchTerm={searchTerm} />
        </TabsContent>

        <TabsContent value="search-prompts" className="pt-4">
          <SearchPromptsTab searchTerm={searchTerm} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default KeywordManagement;
