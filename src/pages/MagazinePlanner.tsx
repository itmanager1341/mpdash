
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Edit, 
  GripVertical, 
  Plus, 
  Save, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  X
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/types/news";

interface IssueContent {
  id: string;
  type: 'article' | 'feature' | 'news' | 'draft';
  title: string;
  status: 'pending' | 'draft' | 'ready' | 'published';
  wordCount: number;
  priority: 'high' | 'medium' | 'low';
}

interface Issue {
  id: string;
  title: string;
  description: string;
  status: 'planning' | 'drafting' | 'review' | 'scheduled' | 'published';
  content: IssueContent[];
  updated_at: string;
}

export default function MagazinePlanner() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDescription, setNewIssueDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch news items for sources
  const { data: newsItems } = useQuery({
    queryKey: ['magazine-news-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('status', 'approved')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Transform the data to match NewsItem type
      return data?.map(item => ({
        ...item,
        template_type: (item.template_type as NewsItem['template_type']) || undefined
      })) as NewsItem[];
    }
  });

  // Fetch editor drafts
  const { data: drafts } = useQuery({
    queryKey: ['magazine-editor-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('editor_briefs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    }
  });

  const handleNewsItemAdd = (newsItem: NewsItem, targetIssueId: string) => {
    setIssues(prev => prev.map(issue => {
      if (issue.id === targetIssueId) {
        const isAlreadyAdded = issue.content.some(
          content => content.type === 'news' && content.id === newsItem.id
        );
        
        if (!isAlreadyAdded) {
          return {
            ...issue,
            content: [...issue.content, {
              id: newsItem.id,
              type: 'news' as const,
              title: newsItem.original_title || 'Untitled News',
              status: 'pending',
              wordCount: 0,
              priority: 'medium'
            }]
          };
        }
      }
      return issue;
    }));
    
    toast.success(`Added "${newsItem.original_title}" to issue`);
  };

  const handleDraftAdd = (draft: any, targetIssueId: string) => {
    setIssues(prev => prev.map(issue => {
      if (issue.id === targetIssueId) {
        const isAlreadyAdded = issue.content.some(
          content => content.type === 'draft' && content.id === draft.id
        );
        
        if (!isAlreadyAdded) {
          return {
            ...issue,
            content: [...issue.content, {
              id: draft.id,
              type: 'draft' as const,
              title: draft.title || draft.theme || 'Untitled Draft',
              status: 'pending',
              wordCount: 0,
              priority: 'medium'
            }]
          };
        }
      }
      return issue;
    }));
    
    toast.success(`Added "${draft.title || draft.theme}" to issue`);
  };

  const createNewIssue = async () => {
    if (!newIssueTitle.trim()) {
      toast.error("Issue title is required");
      return;
    }

    setIsLoading(true);
    try {
      // Since magazine_issues table doesn't exist, we'll just add to local state
      const newIssue: Issue = {
        id: Math.random().toString(36).substr(2, 9),
        title: newIssueTitle,
        description: newIssueDescription,
        status: 'planning',
        content: [],
        updated_at: new Date().toISOString()
      };

      setIssues([...issues, newIssue]);
      setNewIssueTitle('');
      setNewIssueDescription('');
      toast.success("New issue created (local only - magazine_issues table not implemented)");
    } catch (error) {
      console.error("Error creating issue:", error);
      toast.error("Failed to create issue");
    } finally {
      setIsLoading(false);
    }
  };

  const updateIssue = async (issueId: string, field: string, value: string) => {
    setIssues(prev => prev.map(issue =>
      issue.id === issueId ? { ...issue, [field]: value } : issue
    ));
  };

  const updateContent = async (issueId: string, contentId: string, field: string, value: string | number) => {
    setIssues(prev => prev.map(issue => {
      if (issue.id === issueId) {
        return {
          ...issue,
          content: issue.content.map(content => {
            if (content.id === contentId) {
              return { ...content, [field]: value };
            }
            return content;
          })
        };
      }
      return issue;
    }));
  };

  const addContentToIssue = (issueId: string, contentType: 'article' | 'feature') => {
    const newContent = {
      id: Math.random().toString(36).substr(2, 9),
      type: contentType,
      title: `New ${contentType}`,
      status: 'pending' as const,
      wordCount: 0,
      priority: 'medium' as const
    };

    setIssues(prev => prev.map(issue => 
      issue.id === issueId 
        ? { ...issue, content: [...issue.content, newContent] }
        : issue
    ));
  };

  const removeContentFromIssue = (issueId: string, contentId: string) => {
    setIssues(prev => prev.map(issue =>
      issue.id === issueId
        ? { ...issue, content: issue.content.filter(content => content.id !== contentId) }
        : issue
    ));
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      // Since magazine_issues table doesn't exist, we'll just simulate saving
      toast.success("All changes saved (local only - magazine_issues table not implemented)");
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'review':
        return 'bg-blue-100 text-blue-800';
      case 'drafting':
        return 'bg-yellow-100 text-yellow-800';
      case 'planning':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMetadata = (item: any) => {
    try {
      if (typeof item.content_variants === 'string') {
        const parsed = JSON.parse(item.content_variants);
        return parsed.metadata || {};
      } else if (item.content_variants && typeof item.content_variants === 'object') {
        return (item.content_variants as any).metadata || {};
      }
      return {};
    } catch (error) {
      console.error('Error parsing metadata:', error);
      return {};
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Magazine Planner</h1>
          <p className="text-muted-foreground">
            Plan and organize content for upcoming magazine issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={saveAllChanges} disabled={isLoading || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save All Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg mt-6 p-4">
        <h3 className="font-medium text-lg mb-4">Create New Issue</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              type="text"
              placeholder="Issue Title"
              value={newIssueTitle}
              onChange={(e) => setNewIssueTitle(e.target.value)}
            />
          </div>
          <div>
            <Input
              type="text"
              placeholder="Issue Description"
              value={newIssueDescription}
              onChange={(e) => setNewIssueDescription(e.target.value)}
            />
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={createNewIssue}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Create Issue
            </>
          )}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left Panel - Sources */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Available Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {newsItems?.map((newsItem) => (
                    <div
                      key={newsItem.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <h4 className="font-medium text-sm line-clamp-2">
                        {newsItem.original_title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {newsItem.source} • {new Date(newsItem.timestamp).toLocaleDateString()}
                      </p>
                      {newsItem.matched_clusters && newsItem.matched_clusters.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {newsItem.matched_clusters.slice(0, 2).map((cluster, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {cluster}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-2">
                        {issues.map((issue) => (
                          <Button
                            key={issue.id}
                            variant="outline"
                            size="sm"
                            className="mr-1 mb-1"
                            onClick={() => handleNewsItemAdd(newsItem, issue.id)}
                          >
                            Add to {issue.title}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Drafts Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Available Drafts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {drafts?.map((draft) => (
                    <div
                      key={draft.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <h4 className="font-medium text-sm line-clamp-2">
                        {draft.title || draft.theme}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(draft.updated_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-1 mt-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {draft.status?.replace('_', ' ')}
                        </Badge>
                        {getMetadata(draft).tags && (
                          <Badge variant="secondary" className="text-xs">
                            {getMetadata(draft).tags.length} tags
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2">
                        {issues.map((issue) => (
                          <Button
                            key={issue.id}
                            variant="outline"
                            size="sm"
                            className="mr-1 mb-1"
                            onClick={() => handleDraftAdd(draft, issue.id)}
                          >
                            Add to {issue.title}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Center Panel - Issues */}
        <div className="space-y-6">
          {issues.map((issue) => (
            <Card key={issue.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    <Input
                      type="text"
                      placeholder="Issue Title"
                      value={issue.title}
                      onChange={(e) => updateIssue(issue.id, 'title', e.target.value)}
                    />
                  </CardTitle>
                  <Badge className={getStatusColor(issue.status)}>
                    {issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                  </Badge>
                </div>
                <Textarea
                  placeholder="Issue Description"
                  className="mt-2"
                  value={issue.description}
                  onChange={(e) => updateIssue(issue.id, 'description', e.target.value)}
                />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {issue.content.map((content, index) => (
                    <div
                      key={content.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <span className="font-medium text-sm">{content.title}</span>
                        <Badge className={getPriorityColor(content.priority)}>
                          {content.priority.charAt(0).toUpperCase() + content.priority.slice(1)}
                        </Badge>
                        {content.status !== 'pending' && (
                          <Badge className={getStatusColor(content.status)}>
                            {content.status.charAt(0).toUpperCase() + content.status.slice(1)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Word Count"
                          className="w-24 text-sm"
                          value={content.wordCount}
                          onChange={(e) => updateContent(issue.id, content.id, 'wordCount', parseInt(e.target.value))}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContentFromIssue(issue.id, content.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="text-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addContentToIssue(issue.id, 'article')}
                    >
                      Add Article
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addContentToIssue(issue.id, 'feature')}
                    >
                      Add Feature
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right Panel - Actions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Issue Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {issues.map((issue) => (
                  <div key={issue.id} className="space-y-2">
                    <h4 className="font-medium">{issue.title}</h4>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm">
                        View Issue
                      </Button>
                      <Input
                        type="text"
                        placeholder="Update Status"
                        className="text-sm"
                        value={issue.status}
                        onChange={(e) => updateIssue(issue.id, 'status', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
