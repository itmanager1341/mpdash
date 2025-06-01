import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "./SortableTableHead";
import { SimplifiedBulkOperations } from "./SimplifiedBulkOperations";
import { ExternalLink, Trash2, RefreshCw, Search, CheckCircle, Clock, Zap, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ArticleFilter } from "@/pages/ArticlesManagement";

interface ArticlesTableProps {
  articles: any[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: any) => void;
  onRefresh: () => void;
  activeFilter: ArticleFilter;
  selectedArticles: Set<string>;
  onSelectionChange: (newSelection: Set<string>, showWordCount: boolean) => void;
}

type SortField = 'title' | 'author' | 'status' | 'published_at' | 'word_count' | 'wordpress_id' | 'is_chunked';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [
  { value: 20, label: "20 per page" },
  { value: 50, label: "50 per page" },
  { value: 100, label: "100 per page" },
];

export function ArticlesTable({ 
  articles, 
  isLoading, 
  onDelete, 
  onUpdate, 
  onRefresh,
  activeFilter,
  selectedArticles,
  onSelectionChange
}: ArticlesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [articlesPerPage, setArticlesPerPage] = useState(20);
  const [syncingArticleId, setSyncingArticleId] = useState<string | null>(null);
  const [processingChunks, setProcessingChunks] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Apply filter first, then search - removed embedding filters
  const filteredByStatus = articles.filter(article => {
    switch (activeFilter) {
      case 'published':
        return article.status === 'published';
      case 'drafts':
        return article.status === 'draft';
      case 'missing-wp-id':
        return !article.wordpress_id;
      case 'missing-author':
        return !article.primary_author_id;
      case 'no-word-count':
        return !article.word_count || article.word_count === 0;
      case 'chunked':
        return article.is_chunked;
      case 'not-chunked':
        return !article.is_chunked;
      case 'all':
      default:
        return true;
    }
  });

  // Then apply search filter
  const searchFiltered = filteredByStatus.filter(article => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const titleMatch = article.title?.toLowerCase().includes(searchLower);
    const authorMatch = article.authors?.name?.toLowerCase().includes(searchLower) || 
                       article.wordpress_author_name?.toLowerCase().includes(searchLower);
    const excerptMatch = article.excerpt?.toLowerCase().includes(searchLower);
    
    return titleMatch || authorMatch || excerptMatch;
  });

  // Apply sorting
  const sortedArticles = [...searchFiltered].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'title':
        aValue = a.title?.toLowerCase() || '';
        bValue = b.title?.toLowerCase() || '';
        break;
      case 'author':
        aValue = (a.authors?.name || a.wordpress_author_name || '').toLowerCase();
        bValue = (b.authors?.name || b.wordpress_author_name || '').toLowerCase();
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      case 'published_at':
        aValue = a.published_at ? new Date(a.published_at).getTime() : 0;
        bValue = b.published_at ? new Date(b.published_at).getTime() : 0;
        break;
      case 'word_count':
        aValue = a.word_count || 0;
        bValue = b.word_count || 0;
        break;
      case 'wordpress_id':
        aValue = a.wordpress_id || 0;
        bValue = b.wordpress_id || 0;
        break;
      case 'is_chunked':
        aValue = a.is_chunked ? 1 : 0;
        bValue = b.is_chunked ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredArticles = sortedArticles;
  const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const currentArticles = filteredArticles.slice(startIndex, endIndex);

  const handleSort = (field: string) => {
    const typedField = field as SortField;
    if (sortField === typedField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(typedField);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const handlePageSizeChange = (newPageSize: string) => {
    const pageSize = parseInt(newPageSize);
    setArticlesPerPage(pageSize);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(new Set(currentArticles.map(article => article.id)), true);
    } else {
      onSelectionChange(new Set(), false);
    }
  };

  const handleSelectOne = (articleId: string, checked: boolean) => {
    const newSelection = new Set(selectedArticles);
    if (checked) {
      newSelection.add(articleId);
    } else {
      newSelection.delete(articleId);
    }
    onSelectionChange(newSelection, newSelection.size > 0);
  };

  const handleSyncArticle = async (articleId: string) => {
    setSyncingArticleId(articleId);
    try {
      const { data, error } = await supabase.functions.invoke('wordpress-legacy-sync', {
        body: { 
          legacyMode: true,
          targetArticleIds: [articleId]
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Article synced successfully");
        onRefresh();
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Article sync error:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setSyncingArticleId(null);
    }
  };

  const handleProcessChunks = async (articleId: string) => {
    setProcessingChunks(prev => new Set(prev).add(articleId));
    try {
      const { data, error } = await supabase.functions.invoke('process-article-chunks', {
        body: { 
          articleIds: [articleId]
        }
      });

      if (error) throw error;

      if (data.processed > 0) {
        toast.success(`Article chunked successfully - ${data.results[0]?.chunks_created || 0} chunks created`);
        onRefresh();
      } else {
        throw new Error(data.results[0]?.error || 'Chunking failed');
      }
    } catch (error) {
      console.error('Article chunking error:', error);
      toast.error(`Chunking failed: ${error.message}`);
    } finally {
      setProcessingChunks(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
    }
  };

  const handleBulkProcessChunks = async () => {
    if (selectedArticles.size === 0) return;
    
    const articleIds = Array.from(selectedArticles);
    setProcessingChunks(new Set(articleIds));
    
    try {
      const { data, error } = await supabase.functions.invoke('process-article-chunks', {
        body: { 
          articleIds: articleIds,
          limit: articleIds.length
        }
      });

      if (error) throw error;

      toast.success(`Bulk chunking completed - ${data.processed} articles processed`);
      onSelectionChange(new Set(), false);
      onRefresh();
    } catch (error) {
      console.error('Bulk chunking error:', error);
      toast.error(`Bulk chunking failed: ${error.message}`);
    } finally {
      setProcessingChunks(new Set());
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

  const isAllSelected = currentArticles.length > 0 && currentArticles.every(article => selectedArticles.has(article.id));
  const isIndeterminate = selectedArticles.size > 0 && !isAllSelected;

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading articles...</p>
        </div>
      </div>
    );
  }

  const getFilterDescription = () => {
    if (activeFilter === 'all') return '';
    
    const filterLabels = {
      'published': 'published articles',
      'drafts': 'draft articles', 
      'missing-wp-id': 'articles missing WordPress ID',
      'missing-author': 'articles missing author',
      'no-word-count': 'articles missing word count',
      'chunked': 'articles with chunks',
      'not-chunked': 'articles without chunks'
    };
    
    return ` (showing ${filterLabels[activeFilter]})`;
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles by title, author, or content..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page when searching
            }}
            className="pl-10"
          />
        </div>
        {searchTerm && (
          <Button variant="outline" onClick={handleClearSearch}>
            Clear
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {filteredArticles.length} of {articles.length} articles{getFilterDescription()}
        </span>
      </div>

      <SimplifiedBulkOperations
        selectedIds={selectedArticles}
        onClearSelection={() => onSelectionChange(new Set(), false)}
        onRefresh={onRefresh}
        articles={articles}
        onBulkProcessChunks={handleBulkProcessChunks}
        isProcessingChunks={processingChunks.size > 0}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className={isIndeterminate ? "data-[state=indeterminate]:bg-blue-600" : ""}
                />
              </TableHead>
              <SortableTableHead
                sortKey="title"
                currentSort={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Title
              </SortableTableHead>
              <SortableTableHead
                sortKey="author"
                currentSort={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Author
              </SortableTableHead>
              <SortableTableHead
                sortKey="status"
                currentSort={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Status
              </SortableTableHead>
              <SortableTableHead
                sortKey="published_at"
                currentSort={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Published
              </SortableTableHead>
              <SortableTableHead
                sortKey="word_count"
                currentSort={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Word Count
              </SortableTableHead>
              <SortableTableHead
                sortKey="wordpress_id"
                currentSort={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                WP ID
              </SortableTableHead>
              <SortableTableHead
                sortKey="is_chunked"
                currentSort={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Chunked
              </SortableTableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentArticles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No articles found matching your search' : 
                   activeFilter !== 'all' ? `No articles found for this filter` : 'No articles found'}
                </TableCell>
              </TableRow>
            ) : (
              currentArticles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedArticles.has(article.id)}
                      onCheckedChange={(checked) => handleSelectOne(article.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="font-medium truncate">{article.title}</div>
                    {article.excerpt && (
                      <div className="text-sm text-muted-foreground truncate mt-1">
                        {article.excerpt.substring(0, 100)}...
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {article.authors ? (
                      <div className="text-sm">
                        <div className="font-medium">{article.authors.name}</div>
                        <Badge variant="outline" className="text-xs">
                          {article.authors.author_type}
                        </Badge>
                      </div>
                    ) : article.wordpress_author_name ? (
                      <div className="text-sm text-muted-foreground">
                        {article.wordpress_author_name}
                        <Badge variant="secondary" className="text-xs ml-1">
                          WP
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No author</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        article.status === 'published' ? 'default' :
                        article.status === 'draft' ? 'secondary' :
                        'outline'
                      }
                    >
                      {article.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {article.published_at ? (
                      <div className="text-sm">
                        {new Date(article.published_at).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not published</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {article.word_count ? (
                      <div className="text-sm font-medium">
                        {article.word_count.toLocaleString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {article.wordpress_id ? (
                      <Badge variant="outline">
                        {article.wordpress_id}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">No WP ID</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {article.is_chunked ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Package className="h-4 w-4" />
                          <span className="text-xs">
                            {article.chunks_count || 0} chunks
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-500">
                          <span className="text-xs">No chunks</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSyncArticle(article.id)}
                        disabled={syncingArticleId === article.id}
                        title="Sync with WordPress"
                      >
                        {syncingArticleId === article.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProcessChunks(article.id)}
                        disabled={processingChunks.has(article.id)}
                        title="Process into chunks"
                      >
                        {processingChunks.has(article.id) ? (
                          <Zap className="h-4 w-4 animate-pulse text-blue-600" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                      </Button>
                      {article.source_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(article.source_url, '_blank')}
                          title="View on WordPress"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(article.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete article"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredArticles.length)} of {filteredArticles.length} articles
            {searchTerm && ` (filtered from ${filteredByStatus.length} ${activeFilter !== 'all' ? 'filtered ' : ''}articles)`}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select value={articlesPerPage.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
