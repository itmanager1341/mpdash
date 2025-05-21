
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiKeysManager from "@/components/admin/ApiKeysManager";
import UserManagement from "@/components/admin/UserManagement";
import DashboardLayout from "@/components/layout/DashboardLayout";
import NewsImporter from "@/components/admin/NewsImporter";
import ScheduledImportSettings from "@/components/admin/ScheduledImportSettings";
import JobExecutionHistory from "@/components/admin/JobExecutionHistory";
import NewsTextConverter from "@/components/admin/NewsTextConverter";

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState("api-keys");

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
        <p className="text-muted-foreground">
          Configure API keys, scheduled tasks, and user permissions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 md:w-fit">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="scheduled-tasks">Scheduled Tasks</TabsTrigger>
          <TabsTrigger value="import-tools">Import Tools</TabsTrigger>
          <TabsTrigger value="user-management">Users</TabsTrigger>
        </TabsList>
        
        <TabsContent value="api-keys" className="space-y-4">
          <ApiKeysManager />
        </TabsContent>
        
        <TabsContent value="scheduled-tasks" className="space-y-6">
          <ScheduledImportSettings />
          <JobExecutionHistory />
        </TabsContent>
        
        <TabsContent value="import-tools" className="space-y-6">
          <NewsImporter />
          <NewsTextConverter />
        </TabsContent>
        
        <TabsContent value="user-management">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminSettings;
