
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiKeysManager from "@/components/admin/ApiKeysManager";
import UserManagement from "@/components/admin/UserManagement";
import AuthorMappingTool from "@/components/admin/AuthorMappingTool";

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
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="author-mapping">Author Mapping</TabsTrigger>
        </TabsList>
        
        <TabsContent value="api-keys" className="space-y-8">
          <ApiKeysManager />
        </TabsContent>
        
        <TabsContent value="users" className="space-y-8">
          <UserManagement />
        </TabsContent>
        
        <TabsContent value="author-mapping" className="space-y-8">
          <AuthorMappingTool />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminSettings;
