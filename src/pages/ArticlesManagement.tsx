import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Download, 
  RefreshCw, 
  AlertTriangle,
  Users,
  CheckCircle,
  Clock,
  X,
  FileText,
  Edit3,
  UserX,
  Zap,
  ZapOff,
  Package,
  PackageX,
  Calculator
} from "lucide-react";
import { toast } from "sonner";
import { ArticlesTable } from "@/components/admin/ArticlesTable";
import { ArticleImportDialog } from "@/components/admin/ArticleImportDialog";
import { BulkWordCountOperation } from "@/components/admin/BulkWordCountOperation";

export type ArticleFilter = 
  | 'all' 
  | 'published' 
  | 'drafts' 
  | 'missing-wp-id' 
  | 'missing-author' 
  | 'embedded' 
  | 'not-embedded'
  | 'chunked'
  | 'not-chunked'
  | 'no-word-count';

export default function ArticlesManagement() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ArticleFilter>('all');
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [showWordCountOperation, setShowWordCountOperation] = useState(false);
  const queryClient = useQueryClient();

  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const { data, error } = await supabase
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
        .select('id, wordpress_id, primary_author_id, source_url, status, embedding');
      
      if (error) throw error;

      const stats = {
        total: data.length,
        missingWordPressId: data.filter(a => !a.wordpress_id).length,
        missingAuthor: data.filter(a => !a.primary_author_id).length,
        missingSourceUrl: data.filter(a => !a.source_url).length,
        hasEmbedding: data.filter(a => a.embedding).length,
        missingEmbedding: data.filter(a => !a.embedding).length,
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

  const handleClearSelection = () => {
    setSelectedArticles(new Set());
    setShowWordCountOperation(false);
  };

  const totalArticles = articles?.length || 0;
  const publishedArticles = articles?.filter(a => a.status === 'published').length || 0;
  const draftArticles = articles?.filter(a => a.status === 'draft').length || 0;

  // Updated filter options to include word count filter
  const filterOptions = [
    { value: 'all', label: 'All Articles', icon: FileText },
    { value: 'published', label: 'Published', icon: CheckCircle },
    { value: 'drafts', label: 'Drafts', icon: Edit3 },
    { value: 'missing-wp-id', label: 'Missing WP ID', icon: AlertTriangle },
    { value: 'missing-author', label: 'Missing Author', icon: UserX },
    { value: 'no-word-count', label: 'No Word Count', icon: Calculator },
    { value: 'embedded', label: 'With Embeddings', icon: Zap },
    { value: 'not-embedded', label: 'No Embeddings', icon: ZapOff },
    { value: 'chunked', label: 'Chunked', icon: Package },
    { value: 'not-chunked', label: 'Not Chunked', icon: PackageX },
  ];

  const getFilterTitle = () => {
    switch (activeFilter) {
      case 'published': return 'Published Articles';
      case 'drafts': return 'Draft Articles';
      case 'missing-wp-id': return 'Articles Missing WordPress ID';
      case 'missing-author': return 'Articles Missing Author';
      case 'no-word-count': return 'Articles Missing Word Count';
      case 'embedded': return 'Articles with Embeddings';
      case 'not-embedded': return 'Articles without Embeddings';
      case 'chunked': return 'Chunked Articles';
      case 'not-chunked': return 'Not Chunked Articles';
      default: return 'All Articles';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Articles Management</h1>
          <p className="text-muted-foreground">
            Manage articles imported from WordPress and editorial content
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

      {/* Active Filter Indicator */}
      {activeFilter !== 'all' && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-700">
            Showing: {getFilterTitle()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveFilter('all')}
            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Interactive Stats Cards - Updated with word count stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'all' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
          }`}
          onClick={() => setActiveFilter('all')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalArticles}</div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'published' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'
          }`}
          onClick={() => setActiveFilter('published')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{publishedArticles}</div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'drafts' ? 'ring-2 ring-yellow-500 bg-yellow-50' : 'hover:bg-gray-50'
          }`}
          onClick={() => setActiveFilter('drafts')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{draftArticles}</div>
          </CardContent>
        </Card>

        {dataQualityStats && (
          <>
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'missing-wp-id' ? 'ring-2 ring-red-500 bg-red-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => setActiveFilter('missing-wp-id')}
            >
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

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'missing-author' ? 'ring-2 ring-orange-500 bg-orange-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => setActiveFilter('missing-author')}
            >
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

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'embedded' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => setActiveFilter('embedded')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Embedded
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {dataQualityStats.hasEmbedding}
                </div>
                <div 
                  className={`text-xs cursor-pointer transition-colors ${
                    activeFilter === 'not-embedded' ? 'text-blue-600 font-medium' : 'text-muted-foreground hover:text-gray-700'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveFilter('not-embedded');
                  }}
                >
                  <Clock className="h-3 w-3 inline mr-1" />
                  {dataQualityStats.missingEmbedding} not embedded
                </div>
              </CardContent>
            </Card>

            {/* New Word Count Card */}
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'no-word-count' ? 'ring-2 ring-yellow-500 bg-yellow-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => setActiveFilter('no-word-count')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <Calculator className="h-4 w-4 text-yellow-500" />
                  No Word Count
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {articles?.filter(a => !a.word_count || a.word_count === 0).length || 0}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Show word count operation when articles are selected */}
      {selectedArticles.size > 0 && showWordCountOperation && (
        <BulkWordCountOperation
          selectedIds={selectedArticles}
          onClearSelection={handleClearSelection}
          onRefresh={handleRefresh}
          articles={articles || []}
        />
      )}

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
              Use the sync functionality to automatically match and update articles.
            </p>
          </CardContent>
        </Card>
      )}

      <ArticlesTable
        articles={articles || []}
        isLoading={articlesLoading}
        onDelete={handleDeleteArticle}
        onUpdate={handleUpdateArticle}
        onRefresh={handleRefresh}
        activeFilter={activeFilter}
        selectedArticles={selectedArticles}
        onSelectionChange={(newSelection, showWordCount) => {
          setSelectedArticles(newSelection);
          setShowWordCountOperation(showWordCount);
        }}
      />

      <ArticleImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['articles'] });
          queryClient.invalidateQueries({ queryKey: ['data-quality-stats'] });
        }}
      />
    </div>
  );
}
