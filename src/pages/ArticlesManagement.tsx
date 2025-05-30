
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, 
  Calendar, 
  RefreshCw, 
  Search, 
  Edit, 
  Trash2,
  Eye,
  Plus,
  AlertTriangle,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { ArticlesTable } from "@/components/admin/ArticlesTable";
import { ArticleImportDialog } from "@/components/admin/ArticleImportDialog";
import { ImportLogsTable } from "@/components/admin/ImportLogsTable";
import EnhancedWordPressSync from "@/components/admin/EnhancedWordPressSync";

export default function ArticlesManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('articles')
        .select(`
          *,
          authors (
            id,
            name,
            author_type
          )
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: importLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['import-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('article_import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });

  // Data quality stats
  const { data: dataQualityStats } = useQuery({
    queryKey: ['data-quality-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, wordpress_id, primary_author_id, source_url, status');
      
      if (error) throw error;

      const stats = {
        total: data.length,
        missingWordPressId: data.filter(a => !a.wordpress_id).length,
        missingAuthor: data.filter(a => !a.primary_author_id).length,
        missingSourceUrl: data.filter(a => !a.source_url).length,
        legacy: data.filter(a => !a.wordpress_id && !a.source_url).length
      };

      return stats;
    }
  });

  const deleteArticleMutation = useMutation({
    mutationFn: async (articleId: string) => {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Article deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-stats'] });
    },
    onError: (error) => {
      toast.error("Failed to delete article");
      console.error('Delete error:', error);
    }
  });

  const updateArticleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('articles')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Article updated successfully");
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-stats'] });
    },
    onError: (error) => {
      toast.error("Failed to update article");
      console.error('Update error:', error);
    }
  });

  const handleDeleteArticle = (articleId: string) => {
    if (window.confirm('Are you sure you want to delete this article?')) {
      deleteArticleMutation.mutate(articleId);
    }
  };

  const handleUpdateArticle = (id: string, updates: any) => {
    updateArticleMutation.mutate({ id, updates });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['articles'] });
    queryClient.invalidateQueries({ queryKey: ['data-quality-stats'] });
  };

  const totalArticles = articles?.length || 0;
  const publishedArticles = articles?.filter(a => a.status === 'published').length || 0;
  const draftArticles = articles?.filter(a => a.status === 'draft').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Articles Management</h1>
          <p className="text-muted-foreground">
            Manage articles imported from the website and editorial content
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowImportDialog(true)}
          >
            <Download className="h-4 w-4 mr-2" />
            Import Articles
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalArticles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{publishedArticles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{draftArticles}</div>
          </CardContent>
        </Card>
        {dataQualityStats && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Missing WP ID
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {dataQualityStats.missingWordPressId}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-4 w-4 text-orange-500" />
                  Missing Author
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {dataQualityStats.missingAuthor}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Data Quality Alert */}
      {dataQualityStats && (dataQualityStats.missingWordPressId > 0 || dataQualityStats.missingAuthor > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Data Quality Issues Detected</span>
            </div>
            <p className="text-orange-700 text-sm mt-1">
              Some articles are missing WordPress IDs or author assignments. 
              Use the Enhanced WordPress Sync to automatically match and update legacy articles.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="articles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="enhanced-sync">Enhanced WordPress Sync</TabsTrigger>
          <TabsTrigger value="import-logs">Import History</TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <ArticlesTable
            articles={articles || []}
            isLoading={articlesLoading}
            onDelete={handleDeleteArticle}
            onUpdate={handleUpdateArticle}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="enhanced-sync">
          <EnhancedWordPressSync />
        </TabsContent>

        <TabsContent value="import-logs">
          <ImportLogsTable
            logs={importLogs || []}
            isLoading={logsLoading}
          />
        </TabsContent>
      </Tabs>

      <ArticleImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['articles'] });
          queryClient.invalidateQueries({ queryKey: ['import-logs'] });
          queryClient.invalidateQueries({ queryKey: ['data-quality-stats'] });
        }}
      />
    </div>
  );
}
