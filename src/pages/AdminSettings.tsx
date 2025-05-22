import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiKeysManager from "@/components/admin/ApiKeysManager";
import UserManagement from "@/components/admin/UserManagement";
import ScheduledImportSettings from "@/components/admin/ScheduledImportSettings";
import JobExecutionHistory from "@/components/admin/JobExecutionHistory";
import ManualNewsImport from "@/components/admin/ManualNewsImport";

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState("api-keys");

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
        <p className="text-muted-foreground">
          Configure system settings and manage integrations
        </p>
      </div>
      
      <Tabs defaultValue="api-keys" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="scheduled-tasks">Scheduled Tasks</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="jobs">Jobs Monitor</TabsTrigger>
        </TabsList>
        
        <TabsContent value="api-keys" className="space-y-8">
          <ApiKeysManager />
        </TabsContent>
        
        <TabsContent value="scheduled-tasks" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <ScheduledImportSettings />
            </div>
            <div>
              <ManualNewsImport />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="users" className="space-y-8">
          <UserManagement />
        </TabsContent>
        
        <TabsContent value="jobs" className="space-y-8">
          <JobExecutionHistory />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminSettings;
