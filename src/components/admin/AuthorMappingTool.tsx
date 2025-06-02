
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, Users, FileText, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AuthorMappingTool = () => {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Get unmapped articles count
  const { data: unmappedStats, isLoading } = useQuery({
    queryKey: ['unmapped-articles-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, wordpress_author_id')
        .not('wordpress_author_id', 'is', null)
        .is('primary_author_id', null);

      if (error) throw error;
      
      // Group by WordPress author ID
      const groupedByAuthor = data.reduce((acc, article) => {
        const authorId = article.wordpress_author_id;
        if (!acc[authorId]) {
          acc[authorId] = [];
        }
        acc[authorId].push(article);
        return acc;
      }, {} as Record<number, any[]>);

      return {
        totalUnmapped: data.length,
        byAuthor: groupedByAuthor
      };
    }
  });

  // Get available author mappings
  const { data: availableAuthors } = useQuery({
    queryKey: ['author-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('authors')
        .select('id, name, wordpress_author_id')
        .not('wordpress_author_id', 'is', null)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('wordpress-legacy-sync', {
        body: { 
          bulkUpdateUnmapped: true 
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully updated ${data.results.updated} articles`);
      if (data.results.errors.length > 0) {
        toast.warning(`${data.results.errors.length} articles had errors`);
      }
      queryClient.invalidateQueries({ queryKey: ['unmapped-articles-stats'] });
    },
    onError: (error) => {
      toast.error(`Bulk update failed: ${error.message}`);
    }
  });

  const handleBulkUpdate = async () => {
    setIsRunning(true);
    try {
      await bulkUpdateMutation.mutateAsync();
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Author Mapping Tool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading unmapped articles...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Author Mapping Tool
        </CardTitle>
        <CardDescription>
          Fix articles that have WordPress author IDs but no assigned authors in the system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-600">Unmapped Articles</p>
                <p className="text-2xl font-bold text-blue-900">
                  {unmappedStats?.totalUnmapped || 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-600">Available Mappings</p>
                <p className="text-2xl font-bold text-green-900">
                  {availableAuthors?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-600">Unique WP Authors</p>
                <p className="text-2xl font-bold text-orange-900">
                  {Object.keys(unmappedStats?.byAuthor || {}).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Bulk Update Unmapped Articles</h3>
              <p className="text-sm text-muted-foreground">
                This will map articles to authors using existing WordPress author ID mappings
              </p>
            </div>
            <Button 
              onClick={handleBulkUpdate}
              disabled={isRunning || !unmappedStats?.totalUnmapped}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Update {unmappedStats?.totalUnmapped || 0} Articles
                </>
              )}
            </Button>
          </div>

          {/* Breakdown by WordPress Author */}
          {unmappedStats?.byAuthor && Object.keys(unmappedStats.byAuthor).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Unmapped Articles by WordPress Author:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(unmappedStats.byAuthor).map(([wpAuthorId, articles]) => {
                  const authorMapping = availableAuthors?.find(a => a.wordpress_author_id === parseInt(wpAuthorId));
                  return (
                    <div key={wpAuthorId} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div>
                        <span className="text-sm font-medium">WP ID: {wpAuthorId}</span>
                        {authorMapping && (
                          <p className="text-xs text-muted-foreground">→ {authorMapping.name}</p>
                        )}
                      </div>
                      <Badge variant={authorMapping ? "default" : "destructive"}>
                        {articles.length} articles
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Mappings */}
          {availableAuthors && availableAuthors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Available Author Mappings:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableAuthors.map((author) => (
                  <div key={author.id} className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <span className="text-sm font-medium">{author.name}</span>
                    <Badge variant="outline">WP ID: {author.wordpress_author_id}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {unmappedStats?.totalUnmapped === 0 && (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900">All Articles Mapped!</h3>
            <p className="text-muted-foreground">
              All articles with WordPress author IDs have been successfully mapped to system authors.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuthorMappingTool;
