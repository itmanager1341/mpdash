
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar,
  Plus,
  Search,
  Filter,
  BookOpen,
  Clock,
  User,
  Tag,
  ArrowRight,
  MoreHorizontal,
  Edit,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { NewsItem } from "@/types/news";

export default function MagazinePlanner() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [showNewIssueDialog, setShowNewIssueDialog] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [issueDate, setIssueDate] = useState("");

  // Fetch approved magazine articles
  const { data: magazineArticles, isLoading, refetch } = useQuery({
    queryKey: ['magazine-articles', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('news')
        .select('*')
        .contains('destinations', ['magazine'])
        .eq('status', 'approved')
        .order('timestamp', { ascending: false });
      
      if (searchTerm) {
        query = query.or(`original_title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as NewsItem[];
    }
  });

  // Fetch editor briefs for magazine issues
  const { data: magazineIssues } = useQuery({
    queryKey: ['magazine-issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('editor_briefs')
        .select('*')
        .contains('destinations', ['magazine'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const createNewIssue = async () => {
    if (!newIssueTitle.trim() || !issueDate) {
      toast.error("Please provide both title and date for the new issue");
      return;
    }

    try {
      const { error } = await supabase
        .from('editor_briefs')
        .insert({
          title: newIssueTitle,
          theme: 'magazine_issue',
          destinations: ['magazine'],
          status: 'planned',
          content_variants: {
            metadata: {
              issue_date: issueDate,
              created_from: 'magazine_planner'
            }
          }
        });

      if (error) throw error;

      toast.success("New magazine issue created");
      setNewIssueTitle("");
      setIssueDate("");
      setShowNewIssueDialog(false);
      refetch();
    } catch (error) {
      console.error("Error creating issue:", error);
      toast.error("Failed to create magazine issue");
    }
  };

  const addArticleToIssue = async (articleId: string, issueId: string) => {
    try {
      const { error } = await supabase
        .from('news')
        .update({ 
          editor_brief_id: issueId,
          status: 'queued_magazine'
        })
        .eq('id', articleId);

      if (error) throw error;

      toast.success("Article added to magazine issue");
      refetch();
    } catch (error) {
      console.error("Error adding article to issue:", error);
      toast.error("Failed to add article to issue");
    }
  };

  const getArticlesByIssue = (issueId: string) => {
    return magazineArticles?.filter(article => article.editor_brief_id === issueId) || [];
  };

  const getUnassignedArticles = () => {
    return magazineArticles?.filter(article => !article.editor_brief_id) || [];
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Magazine Planner</h1>
            <p className="text-muted-foreground">
              Plan and organize content for MortgagePoint Magazine
            </p>
          </div>
          <Button onClick={() => setShowNewIssueDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Issue
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* New Issue Dialog */}
        {showNewIssueDialog && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>Create New Magazine Issue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Issue Title</label>
                <Input
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  placeholder="e.g., March 2024 Issue"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Issue Date</label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createNewIssue}>Create Issue</Button>
                <Button variant="outline" onClick={() => setShowNewIssueDialog(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="issues" className="space-y-4">
          <TabsList>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="unassigned">
              Unassigned Articles ({getUnassignedArticles().length})
            </TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>

          <TabsContent value="issues" className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8">Loading magazine issues...</div>
            ) : magazineIssues && magazineIssues.length > 0 ? (
              <div className="grid gap-6">
                {magazineIssues.map((issue) => {
                  const issueArticles = getArticlesByIssue(issue.id);
                  
                  return (
                    <Card key={issue.id} className="overflow-hidden">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-3">
                              <BookOpen className="h-5 w-5" />
                              {issue.title}
                            </CardTitle>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{issue.content_variants?.metadata?.issue_date || 'No date set'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {issue.status?.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        {issueArticles.length > 0 ? (
                          <div className="space-y-3">
                            <div className="text-sm font-medium">
                              Articles ({issueArticles.length})
                            </div>
                            <div className="grid gap-3">
                              {issueArticles.map((article) => (
                                <div
                                  key={article.id}
                                  className="flex items-start justify-between p-3 border rounded-lg bg-muted/20"
                                >
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium line-clamp-1 mb-1">
                                      {article.original_title}
                                    </h4>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                      {article.summary}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span>{article.source}</span>
                                      <span>{new Date(article.timestamp).toLocaleDateString()}</span>
                                      {article.perplexity_score && (
                                        <span>Score: {article.perplexity_score.toFixed(1)}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 ml-3">
                                    <Button variant="ghost" size="sm">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No articles assigned to this issue yet</p>
                            <p className="text-sm">Drag articles from the unassigned tab or use the assign button</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">No Magazine Issues</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first magazine issue to start planning content
                </p>
                <Button onClick={() => setShowNewIssueDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Issue
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="unassigned" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Articles approved for magazine but not yet assigned to an issue
            </div>
            
            {getUnassignedArticles().length > 0 ? (
              <div className="grid gap-4">
                {getUnassignedArticles().map((article) => (
                  <Card key={article.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-2 mb-2">
                            {article.original_title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {article.summary}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{article.source}</span>
                            <span>{new Date(article.timestamp).toLocaleDateString()}</span>
                            {article.perplexity_score && (
                              <span>Score: {article.perplexity_score.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          {magazineIssues && magazineIssues.length > 0 ? (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  addArticleToIssue(article.id, e.target.value);
                                }
                              }}
                              className="text-sm border rounded px-3 py-1"
                              defaultValue=""
                            >
                              <option value="" disabled>Assign to issue...</option>
                              {magazineIssues.map((issue) => (
                                <option key={issue.id} value={issue.id}>
                                  {issue.title}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Create an issue first
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Tag className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">All Articles Assigned</h3>
                <p className="text-muted-foreground">
                  All approved magazine articles have been assigned to issues
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar">
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">Calendar View</h3>
              <p className="text-muted-foreground">
                Calendar view for magazine planning coming soon
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
