
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ApiKeysManager from "@/components/admin/ApiKeysManager";
import NewsImporter from "@/components/admin/NewsImporter";
import UserManagement from "@/components/admin/UserManagement";
import ArticleAnalysis from "@/components/admin/ArticleAnalysis";
import NewsArticleMatching from "@/components/admin/NewsArticleMatching";
import ArticlesManagement from "./ArticlesManagement";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("api-keys");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage API keys, articles, AI analysis, and user management
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="news-matching">News Matching</TabsTrigger>
            <TabsTrigger value="news-import">News Import</TabsTrigger>
            <TabsTrigger value="articles">Articles</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Perplexity AI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ApiKeysManager />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ai-analysis" className="space-y-4">
            <ArticleAnalysis />
          </TabsContent>

          <TabsContent value="news-matching" className="space-y-4">
            <NewsArticleMatching />
          </TabsContent>

          <TabsContent value="news-import" className="space-y-4">
            <NewsImporter />
          </TabsContent>

          <TabsContent value="articles">
            <ArticlesManagement />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <UserManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
