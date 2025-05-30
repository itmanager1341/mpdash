
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Edit, 
  Trash2, 
  Eye, 
  Check, 
  X, 
  ExternalLink,
  Calendar,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { AuthorSelector } from "@/components/editorial/AuthorSelector";
import { TemplateSelector } from "@/components/editorial/TemplateSelector";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { BulkOperationsToolbar } from "./BulkOperationsToolbar";

interface Article {
  id: string;
  title: string;
  status: string;
  article_date: string;
  published_at?: string;
  source_url?: string;
  excerpt?: string;
  word_count?: number;
  read_time_minutes?: number;
  primary_author_id?: string;
  template_type?: string;
  wordpress_id?: number;
  created_at: string;
  authors?: {
    id: string;
    name: string;
    author_type: string;
  };
}

interface ArticlesTableProps {
  articles: Article[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: any) => void;
  onRefresh?: () => void;
}

type SortColumn = 'published_at' | 'author' | 'created_at' | null;
type SortDirection = 'asc' | 'desc';

export function ArticlesTable({ 
  articles, 
  isLoading, 
  onDelete, 
  onUpdate, 
  onRefresh 
}: ArticlesTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const itemsPerPage = 20;

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentPageArticleIds = paginatedArticles.map(article => article.id);
      setSelectedArticles(new Set(currentPageArticleIds));
    } else {
      setSelectedArticles(new Set());
    }
  };

  const handleSelectArticle = (articleId: string, checked: boolean) => {
    const newSelected = new Set(selectedArticles);
    if (checked) {
      newSelected.add(articleId);
    } else {
      newSelected.delete(articleId);
    }
    setSelectedArticles(newSelected);
  };

  const getSortedArticles = () => {
    if (!sortColumn) return articles;

    return [...articles].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'published_at':
          aValue = a.published_at ? new Date(a.published_at).getTime() : 0;
          bValue = b.published_at ? new Date(b.published_at).getTime() : 0;
          break;
        case 'author':
          aValue = a.authors?.name || '';
          bValue = b.authors?.name || '';
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const sortedArticles = getSortedArticles();
  const totalPages = Math.ceil(sortedArticles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedArticles = sortedArticles.slice(startIndex, startIndex + itemsPerPage);

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const handleEdit = (article: Article) => {
    setEditingId(article.id);
    setEditForm({
      title: article.title,
      status: article.status,
      primary_author_id: article.primary_author_id,
      template_type: article.template_type
    });
  };

  const handleSave = () => {
    if (editingId) {
      onUpdate(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const currentPageIds = new Set(paginatedArticles.map(a => a.id));
  const allCurrentPageSelected = currentPageIds.size > 0 && 
    [...currentPageIds].every(id => selectedArticles.has(id));
  const someCurrentPageSelected = [...currentPageIds].some(id => selectedArticles.has(id));

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BulkOperationsToolbar
        selectedIds={selectedArticles}
        onClearSelection={() => setSelectedArticles(new Set())}
        onRefresh={() => {
          setSelectedArticles(new Set());
          onRefresh?.();
        }}
        articles={articles}
      />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={allCurrentPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someCurrentPageSelected && !allCurrentPageSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </TableHead>
              <TableHead>WordPress</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50" 
                onClick={() => handleSort('author')}
              >
                <div className="flex items-center gap-1">
                  Author
                  {getSortIcon('author')}
                </div>
              </TableHead>
              <TableHead>Template</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50" 
                onClick={() => handleSort('published_at')}
              >
                <div className="flex items-center gap-1">
                  Published Date
                  {getSortIcon('published_at')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50" 
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center gap-1">
                  Date
                  {getSortIcon('created_at')}
                </div>
              </TableHead>
              <TableHead>Words</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedArticles.map((article) => (
              <TableRow key={article.id} className={selectedArticles.has(article.id) ? "bg-blue-50" : ""}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedArticles.has(article.id)}
                    onChange={(e) => handleSelectArticle(article.id, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {article.wordpress_id ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        WP: {article.wordpress_id}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        No WP ID
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-md">
                  {editingId === article.id ? (
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="text-sm"
                    />
                  ) : (
                    <div>
                      <div className="font-medium truncate">{article.title}</div>
                      {article.excerpt && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {article.excerpt}
                        </div>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === article.id ? (
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  ) : (
                    <Badge className={getStatusColor(article.status)}>
                      {article.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === article.id ? (
                    <div className="w-48">
                      <AuthorSelector
                        selectedAuthorId={editForm.primary_author_id}
                        onAuthorChange={(authorId) => 
                          setEditForm({ ...editForm, primary_author_id: authorId })
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="text-sm">
                        {article.authors?.name || (
                          <span className="text-red-600">Unassigned</span>
                        )}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === article.id ? (
                    <div className="w-48">
                      <TemplateSelector
                        selectedTemplate={editForm.template_type}
                        onTemplateChange={(template) => 
                          setEditForm({ ...editForm, template_type: template })
                        }
                      />
                    </div>
                  ) : (
                    <span className="text-sm">
                      {article.template_type || '-'}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3" />
                    {article.published_at 
                      ? new Date(article.published_at).toLocaleDateString()
                      : '-'
                    }
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {article.word_count ? (
                      <div>
                        <div>{article.word_count.toLocaleString()} words</div>
                        <div className="text-xs text-muted-foreground">
                          {article.read_time_minutes} min read
                        </div>
                      </div>
                    ) : '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {editingId === article.id ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={handleSave}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancel}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setPreviewArticle(article)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleEdit(article)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {article.source_url && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => window.open(article.source_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => onDelete(article.id)}
                          className="text-red-600 hover:text-red-700"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedArticles.length)} of {sortedArticles.length} articles
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewArticle} onOpenChange={() => setPreviewArticle(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewArticle?.title}</DialogTitle>
          </DialogHeader>
          {previewArticle && (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Status: {previewArticle.status}</span>
                <span>Words: {previewArticle.word_count}</span>
                <span>Read time: {previewArticle.read_time_minutes} min</span>
                {previewArticle.published_at && (
                  <span>Published: {new Date(previewArticle.published_at).toLocaleDateString()}</span>
                )}
                {previewArticle.wordpress_id && (
                  <span>WP ID: {previewArticle.wordpress_id}</span>
                )}
              </div>
              {previewArticle.excerpt && (
                <p className="text-muted-foreground italic">{previewArticle.excerpt}</p>
              )}
              {previewArticle.source_url && (
                <Button 
                  variant="outline" 
                  onClick={() => window.open(previewArticle.source_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Original
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
