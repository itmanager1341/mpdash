
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  TrendingUp, 
  Edit2, 
  Trash2, 
  BarChart3,
  Info,
  RefreshCw
} from "lucide-react";

interface KeywordTrackingTabProps {
  searchTerm: string;
}

interface KeywordEntry {
  id: string;
  keyword: string;
  category: string;
  priority: string;
  status: string;
  article_count: number;
  last_searched_date: string;
  created_at: string;
}

export default function KeywordTrackingTab({ searchTerm }: KeywordTrackingTabProps) {
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<KeywordEntry | null>(null);
  const [newKeyword, setNewKeyword] = useState({
    keyword: '',
    category: '',
    priority: 'medium',
    status: 'active'
  });

  const { data: keywords, isLoading, refetch } = useQuery({
    queryKey: ['keyword-tracking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_tracking')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KeywordEntry[];
    }
  });

  const filteredKeywords = keywords?.filter(keyword => 
    keyword.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (keyword.category && keyword.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddKeyword = async () => {
    if (!newKeyword.keyword.trim()) {
      toast.error("Please enter a keyword");
      return;
    }

    try {
      const { error } = await supabase
        .from('keyword_tracking')
        .insert({
          keyword: newKeyword.keyword.trim(),
          category: newKeyword.category.trim() || null,
          priority: newKeyword.priority,
          status: newKeyword.status,
          article_count: 0
        });

      if (error) throw error;

      toast.success("Keyword added successfully");
      setNewKeyword({ keyword: '', category: '', priority: 'medium', status: 'active' });
      setIsAddingKeyword(false);
      refetch();
    } catch (error) {
      console.error('Error adding keyword:', error);
      toast.error("Failed to add keyword");
    }
  };

  const handleUpdateKeyword = async () => {
    if (!editingKeyword) return;

    try {
      const { error } = await supabase
        .from('keyword_tracking')
        .update({
          keyword: editingKeyword.keyword.trim(),
          category: editingKeyword.category?.trim() || null,
          priority: editingKeyword.priority,
          status: editingKeyword.status
        })
        .eq('id', editingKeyword.id);

      if (error) throw error;

      toast.success("Keyword updated successfully");
      setEditingKeyword(null);
      refetch();
    } catch (error) {
      console.error('Error updating keyword:', error);
      toast.error("Failed to update keyword");
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    if (!confirm("Are you sure you want to delete this keyword?")) return;

    try {
      const { error } = await supabase
        .from('keyword_tracking')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Keyword deleted successfully");
      refetch();
    } catch (error) {
      console.error('Error deleting keyword:', error);
      toast.error("Failed to delete keyword");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'monitoring': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalKeywords = keywords?.length || 0;
  const activeKeywords = keywords?.filter(k => k.status === 'active').length || 0;
  const totalArticles = keywords?.reduce((sum, k) => sum + (k.article_count || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Integration Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Article counts are automatically updated when articles are analyzed using AI Analysis. 
          Keywords extracted from articles will increment the counts for matching tracked keywords.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Search className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-600">Total Keywords</p>
                <p className="text-2xl font-bold text-blue-900">{totalKeywords}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-600">Active Keywords</p>
                <p className="text-2xl font-bold text-green-900">{activeKeywords}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-600">Total Articles</p>
                <p className="text-2xl font-bold text-purple-900">{totalArticles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Keyword Form */}
      {isAddingKeyword && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Keyword</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="keyword">Keyword</Label>
                <Input
                  id="keyword"
                  value={newKeyword.keyword}
                  onChange={(e) => setNewKeyword(prev => ({ ...prev, keyword: e.target.value }))}
                  placeholder="Enter keyword or phrase"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={newKeyword.category}
                  onChange={(e) => setNewKeyword(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., rates, regulations, market"
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={newKeyword.priority} onValueChange={(value) => setNewKeyword(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={newKeyword.status} onValueChange={(value) => setNewKeyword(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddKeyword}>Add Keyword</Button>
              <Button variant="outline" onClick={() => setIsAddingKeyword(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keywords Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Keyword Tracking</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setIsAddingKeyword(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Keyword
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading keywords...</div>
          ) : filteredKeywords && filteredKeywords.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Article Count</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeywords.map((keyword) => (
                    <TableRow key={keyword.id}>
                      <TableCell>
                        {editingKeyword?.id === keyword.id ? (
                          <Input
                            value={editingKeyword.keyword}
                            onChange={(e) => setEditingKeyword(prev => prev ? { ...prev, keyword: e.target.value } : null)}
                            className="max-w-48"
                          />
                        ) : (
                          <span className="font-medium">{keyword.keyword}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingKeyword?.id === keyword.id ? (
                          <Input
                            value={editingKeyword.category || ''}
                            onChange={(e) => setEditingKeyword(prev => prev ? { ...prev, category: e.target.value } : null)}
                            className="max-w-32"
                          />
                        ) : (
                          keyword.category || '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {editingKeyword?.id === keyword.id ? (
                          <Select 
                            value={editingKeyword.priority} 
                            onValueChange={(value) => setEditingKeyword(prev => prev ? { ...prev, priority: value } : null)}
                          >
                            <SelectTrigger className="max-w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={getPriorityColor(keyword.priority)}>
                            {keyword.priority}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingKeyword?.id === keyword.id ? (
                          <Select 
                            value={editingKeyword.status} 
                            onValueChange={(value) => setEditingKeyword(prev => prev ? { ...prev, status: value } : null)}
                          >
                            <SelectTrigger className="max-w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="monitoring">Monitoring</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={getStatusColor(keyword.status)}>
                            {keyword.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{keyword.article_count || 0}</span>
                          {keyword.article_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              articles
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {keyword.last_searched_date ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(keyword.last_searched_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {editingKeyword?.id === keyword.id ? (
                            <>
                              <Button size="sm" onClick={handleUpdateKeyword}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingKeyword(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingKeyword(keyword)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteKeyword(keyword.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No keywords found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'No keywords match your search.' : 'Start tracking keywords to monitor content performance.'}
              </p>
              <Button onClick={() => setIsAddingKeyword(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Keyword
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
