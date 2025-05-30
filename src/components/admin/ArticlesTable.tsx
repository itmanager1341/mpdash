
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkOperationsToolbar } from "./BulkOperationsToolbar";
import { ExternalLink, Edit, Trash2, Eye } from "lucide-react";

interface ArticlesTableProps {
  articles: any[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: any) => void;
  onRefresh: () => void;
}

export function ArticlesTable({ 
  articles, 
  isLoading, 
  onDelete, 
  onUpdate, 
  onRefresh 
}: ArticlesTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(articles.map(article => article.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (articleId: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(articleId);
    } else {
      newSelection.delete(articleId);
    }
    setSelectedIds(newSelection);
  };

  const isAllSelected = articles.length > 0 && selectedIds.size === articles.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < articles.length;

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

  return (
    <div className="space-y-4">
      <BulkOperationsToolbar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds(new Set())}
        onRefresh={onRefresh}
        articles={articles}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>WP ID</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No articles found
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(article.id)}
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
                      {article.source_system && (
                        <Badge variant="outline" className="text-xs">
                          {article.source_system}
                        </Badge>
                      )}
                      {article.source_url && (
                        <a 
                          href={article.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {article.source_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(article.source_url, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(article.id)}
                        className="text-red-600 hover:text-red-700"
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
    </div>
  );
}
