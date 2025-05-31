import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Enhanced similarity scoring for title matching
function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalize = (str: string) => str.toLowerCase().trim().replace(/[^\w\s]/g, '');
  const norm1 = normalize(title1);
  const norm2 = normalize(title2);
  
  // Exact match
  if (norm1 === norm2) return 1.0;
  
  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;
  
  // Word overlap scoring
  const words1 = new Set(norm1.split(/\s+/));
  const words2 = new Set(norm2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Check for existing WordPress ID conflicts
async function checkWordPressIdConflict(supabase: any, wpId: number, currentArticleId: string) {
  const { data: existingArticle } = await supabase
    .from('articles')
    .select('id, title, published_at')
    .eq('wordpress_id', wpId)
    .neq('id', currentArticleId)
    .maybeSingle();
  
  return existingArticle;
}

// Handle duplicate article resolution
async function resolveDuplicateArticle(supabase: any, currentArticle: any, conflictingArticle: any, wpPost: any) {
  console.log(`Resolving duplicate: Current article "${currentArticle.title}" vs Existing article "${conflictingArticle.title}"`);
  
  // Check if they're essentially the same article (same title and similar date)
  const titleSimilarity = calculateTitleSimilarity(currentArticle.title, conflictingArticle.title);
  const currentDate = new Date(currentArticle.published_at || currentArticle.article_date);
  const conflictingDate = new Date(conflictingArticle.published_at);
  const dateDiff = Math.abs(currentDate.getTime() - conflictingDate.getTime()) / (1000 * 60 * 60 * 24); // days
  
  if (titleSimilarity >= 0.95 && dateDiff <= 7) {
    // Articles are very similar - merge them
    console.log(`Merging duplicate articles - keeping existing article ${conflictingArticle.id}, deleting ${currentArticle.id}`);
    
    // Delete the current article since the other one already has the WordPress ID
    const { error: deleteError } = await supabase
      .from('articles')
      .delete()
      .eq('id', currentArticle.id);
    
    if (deleteError) {
      console.error('Error deleting duplicate article:', deleteError);
      return { action: 'error', error: deleteError.message };
    }
    
    return { 
      action: 'merged', 
      deletedArticleId: currentArticle.id, 
      keptArticleId: conflictingArticle.id,
      mergeDetails: {
        deletedTitle: currentArticle.title,
        keptTitle: conflictingArticle.title,
        titleSimilarity,
        dateDiff,
        wordpressId: wpPost.id,
        mergedAt: new Date().toISOString()
      }
    };
  } else {
    // Articles are different - clear the WordPress ID from the conflicting article
    console.log(`Different articles with same WP ID - clearing WP ID from conflicting article ${conflictingArticle.id}`);
    
    const { error: clearError } = await supabase
      .from('articles')
      .update({ 
        wordpress_id: null,
        last_wordpress_sync: new Date().toISOString()
      })
      .eq('id', conflictingArticle.id);
    
    if (clearError) {
      console.error('Error clearing WordPress ID:', clearError);
      return { action: 'error', error: clearError.message };
    }
    
    return { action: 'conflict_resolved', clearedArticleId: conflictingArticle.id };
  }
}

// Search for WordPress post by title
async function searchWordPressPostByTitle(title: string, wordpressUrl: string, auth: string) {
  if (!title || title.length < 5) return null;
  
  console.log(`Searching WordPress for exact title: "${title}"`);
  
  // First try exact title search
  const exactSearchQuery = encodeURIComponent(title);
  const exactSearchUrl = `${wordpressUrl}/wp-json/wp/v2/posts?search=${exactSearchQuery}&per_page=10&_embed`;
  
  try {
    const response = await fetch(exactSearchUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`WordPress search failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const results = await response.json();
    console.log(`WordPress search returned ${results.length} results`);
    
    if (!results || results.length === 0) {
      console.log('No WordPress posts found');
      return null;
    }

    // Log all found results for debugging
    results.forEach((post: any, index: number) => {
      console.log(`Result ${index + 1}: "${post.title.rendered}" (ID: ${post.id})`);
    });

    // First check for exact match
    let exactMatch = results.find((post: any) => 
      post.title.rendered.toLowerCase().trim() === title.toLowerCase().trim()
    );

    if (exactMatch) {
      console.log(`Found EXACT WordPress match: "${exactMatch.title.rendered}" (ID: ${exactMatch.id})`);
      return { post: exactMatch, similarity: 1.0 };
    }

    // Find best similarity match with lower threshold
    let bestMatch = null;
    let bestScore = 0.6; // Lowered from 0.8

    for (const post of results) {
      const similarity = calculateTitleSimilarity(title, post.title.rendered);
      console.log(`Similarity for "${post.title.rendered}": ${similarity.toFixed(3)}`);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = { post, similarity };
      }
    }

    if (bestMatch) {
      console.log(`Found WordPress match: "${bestMatch.post.title.rendered}" (confidence: ${bestScore.toFixed(2)})`);
      return bestMatch;
    } else {
      console.log(`No matches above threshold (${0.6}) found`);
    }

    return null;
  } catch (error) {
    console.error('WordPress search error:', error);
    return null;
  }
}

// Simplified author handling - works directly with authors table
async function handleAuthor(supabase: any, wpAuthorId: number, wpAuthorData: any) {
  console.log(`Processing author:`, {
    wordpress_author_id: wpAuthorId,
    author_data: wpAuthorData ? {
      name: wpAuthorData.name,
      slug: wpAuthorData.slug,
      description: wpAuthorData.description
    } : 'No author data'
  });

  if (!wpAuthorData || !wpAuthorId) {
    console.log('No author data available');
    return null;
  }

  // Check if author already exists by WordPress ID
  const { data: existingAuthor } = await supabase
    .from('authors')
    .select('id, name')
    .eq('wordpress_author_id', wpAuthorId)
    .maybeSingle();

  if (existingAuthor) {
    console.log(`Found existing author by WordPress ID: ${existingAuthor.name} (${existingAuthor.id})`);
    return existingAuthor.id;
  }

  // Try to find existing author by name (case-insensitive)
  const { data: authorByName } = await supabase
    .from('authors')
    .select('id, name, wordpress_author_id')
    .ilike('name', wpAuthorData.name)
    .maybeSingle();

  if (authorByName && !authorByName.wordpress_author_id) {
    // Found existing author without WordPress ID - update it
    console.log(`Found existing author by name, updating with WordPress info: ${authorByName.name} (${authorByName.id})`);
    
    const { error: updateError } = await supabase
      .from('authors')
      .update({
        wordpress_author_id: wpAuthorId,
        wordpress_author_name: wpAuthorData.name
      })
      .eq('id', authorByName.id);

    if (updateError) {
      console.error('Error updating author with WordPress info:', updateError);
    }

    return authorByName.id;
  }

  // Create new author
  console.log(`Creating new author: ${wpAuthorData.name}`);
  const { data: newAuthor, error: authorError } = await supabase
    .from('authors')
    .insert({
      name: wpAuthorData.name,
      author_type: 'external',
      email: wpAuthorData.email || null,
      bio: wpAuthorData.description || null,
      wordpress_author_id: wpAuthorId,
      wordpress_author_name: wpAuthorData.name,
      is_active: true
    })
    .select('id')
    .single();

  if (authorError) {
    console.error('Error creating author:', authorError);
    return null;
  }

  console.log(`Created new author: ${wpAuthorData.name} (${newAuthor.id})`);
  return newAuthor.id;
}

// Check if operation is cancelled
async function checkCancellation(supabase: any, operationId: string) {
  if (!operationId) return false;
  
  const { data } = await supabase
    .from('sync_operations')
    .select('status')
    .eq('id', operationId)
    .single();
    
  return data?.status === 'cancelled';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get WordPress credentials from environment secrets
    const wordpressUrl = Deno.env.get('WORDPRESS_URL')
    const username = Deno.env.get('WORDPRESS_USERNAME')
    const password = Deno.env.get('WORDPRESS_PASSWORD')
    
    if (!wordpressUrl || !username || !password) {
      throw new Error('WordPress credentials not configured')
    }
    
    const { 
      maxArticles = 100, 
      startDate, 
      endDate, 
      legacyMode = true,
      targetArticleIds = null,
      operationId = null
    } = await req.json().catch(() => ({}))

    console.log(`Starting enhanced WordPress sync`)
    console.log(`Target articles: ${targetArticleIds ? targetArticleIds.length : 'all'}`)
    console.log(`Date range: ${startDate || 'no start'} to ${endDate || 'no end'}`)
    console.log(`Operation ID: ${operationId}`)

    // Create sync operation record
    const { data: syncOperation, error: syncOpError } = await supabase
      .from('sync_operations')
      .insert({
        operation_type: targetArticleIds ? 'selected_article_sync' : 'wordpress_import',
        total_items: targetArticleIds ? targetArticleIds.length : 0,
        status: 'running'
      })
      .select('id')
      .single();

    if (syncOpError) {
      console.error('Failed to create sync operation:', syncOpError);
    }

    const syncOpId = syncOperation?.id;

    const auth = btoa(`${username}:${password}`)

    const syncResults = {
      processed: 0,
      created: 0,
      updated: 0,
      matched: 0,
      skipped: 0,
      merged: 0,
      conflicts_resolved: 0,
      errors: [],
      matchDetails: [],
      mergeDecisions: [],
      errorDetails: []
    }

    let articlesToProcess = [];

    // If targetArticleIds is provided, fetch only those articles from database
    if (targetArticleIds && targetArticleIds.length > 0) {
      console.log(`Fetching ${targetArticleIds.length} selected articles from database...`);
      
      const { data: selectedArticles, error } = await supabase
        .from('articles')
        .select('*')
        .in('id', targetArticleIds);

      if (error) {
        throw new Error(`Failed to fetch selected articles: ${error.message}`);
      }

      if (!selectedArticles || selectedArticles.length === 0) {
        throw new Error('No articles found with the provided IDs');
      }

      console.log(`Found ${selectedArticles.length} articles to sync`);
      articlesToProcess = selectedArticles;
    } else {
      // ... keep existing code (WordPress API fetching logic)
      console.log('No target articles specified, fetching from WordPress API...');
      
      let wpApiUrl = `${wordpressUrl}/wp-json/wp/v2/posts?per_page=100&_embed`
      if (startDate) wpApiUrl += `&after=${startDate}T00:00:00`
      if (endDate) wpApiUrl += `&before=${endDate}T23:59:59`
      
      let allArticles = []
      let page = 1
      let totalFetched = 0
      
      while (totalFetched < maxArticles) {
        if (operationId && await checkCancellation(supabase, operationId)) {
          console.log('Operation cancelled by user');
          return new Response(JSON.stringify({ success: false, error: 'Operation cancelled' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }

        const remainingArticles = maxArticles - totalFetched
        const perPage = Math.min(remainingArticles, 100)
        
        let currentUrl = wpApiUrl.replace(/per_page=\d+/, `per_page=${perPage}`)
        if (page > 1) currentUrl += `&page=${page}`
        
        const wpResponse = await fetch(currentUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        })

        if (!wpResponse.ok) {
          if (wpResponse.status === 400 && page > 1) break
          throw new Error(`WordPress API error: ${wpResponse.status} - ${wpResponse.statusText}`)
        }

        const wpArticles = await wpResponse.json()
        if (!wpArticles || wpArticles.length === 0) break
        
        allArticles.push(...wpArticles)
        totalFetched += wpArticles.length
        
        if (wpArticles.length < perPage) break
        page++
      }
      
      articlesToProcess = allArticles;
    }

    console.log(`Processing ${articlesToProcess.length} articles...`)

    // Update total_items now that we know the count
    if (syncOpId) {
      await supabase
        .from('sync_operations')
        .update({ total_items: articlesToProcess.length })
        .eq('id', syncOpId);
    }

    for (let i = 0; i < articlesToProcess.length; i++) {
      // Check for cancellation every few articles
      if (operationId && i % 5 === 0 && await checkCancellation(supabase, operationId)) {
        console.log('Operation cancelled by user');
        break;
      }

      const article = articlesToProcess[i];
      
      try {
        syncResults.processed++
        
        // Update progress
        if (syncOpId) {
          await supabase
            .from('sync_operations')
            .update({ completed_items: syncResults.processed })
            .eq('id', syncOpId);
        }
        
        console.log(`\n--- Processing article ${syncResults.processed}/${articlesToProcess.length} ---`);

        // Handle different article sources
        let wpPost = null;
        let authorId = null;

        if (targetArticleIds) {
          // For selected articles, search WordPress for matching post
          console.log(`Database article: "${article.title}"`);
          console.log(`Published: ${article.published_at}, WP ID: ${article.wordpress_id || 'none'}`);

          if (article.wordpress_id) {
            // Try to fetch by WordPress ID first
            try {
              const wpResponse = await fetch(`${wordpressUrl}/wp-json/wp/v2/posts/${article.wordpress_id}?_embed`, {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json'
                }
              });

              if (wpResponse.ok) {
                wpPost = await wpResponse.json();
                console.log(`Found WordPress post by ID: ${wpPost.id}`);
              }
            } catch (error) {
              console.log(`Failed to fetch by WP ID: ${error.message}`);
            }
          }

          if (!wpPost) {
            // Search by title
            const searchResult = await searchWordPressPostByTitle(article.title, wordpressUrl, auth);
            if (searchResult) {
              wpPost = searchResult.post;
              console.log(`Found WordPress post by title search: ${wpPost.id}`);
            }
          }

          if (!wpPost) {
            console.log(`No WordPress post found for: "${article.title}"`);
            syncResults.skipped++;
            syncResults.errors.push(`No WordPress match found for "${article.title}"`);
            continue;
          }

          // Check for WordPress ID conflicts before proceeding
          if (wpPost.id !== article.wordpress_id) {
            const conflictingArticle = await checkWordPressIdConflict(supabase, wpPost.id, article.id);
            if (conflictingArticle) {
              console.log(`WordPress ID conflict detected: ${wpPost.id} already assigned to article ${conflictingArticle.id}`);
              
              const resolution = await resolveDuplicateArticle(supabase, article, conflictingArticle, wpPost);
              
              if (resolution.action === 'merged') {
                syncResults.merged++;
                syncResults.mergeDecisions.push({
                  id: `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  type: 'automatic_merge',
                  deletedArticle: {
                    id: resolution.deletedArticleId,
                    title: resolution.mergeDetails.deletedTitle
                  },
                  keptArticle: {
                    id: resolution.keptArticleId,
                    title: resolution.mergeDetails.keptTitle
                  },
                  reason: `High similarity (${(resolution.mergeDetails.titleSimilarity * 100).toFixed(1)}%) and close dates (${resolution.mergeDetails.dateDiff.toFixed(1)} days apart)`,
                  canUndo: true,
                  mergedAt: resolution.mergeDetails.mergedAt,
                  wordpressId: resolution.mergeDetails.wordpressId
                });
                
                syncResults.matchDetails.push({
                  wordpress_id: wpPost.id,
                  article_id: resolution.keptArticleId,
                  deleted_duplicate_id: resolution.deletedArticleId,
                  match_type: 'merged_duplicate',
                  confidence: resolution.mergeDetails.titleSimilarity,
                  title: article.title
                });
                console.log(`✓ Merged duplicate article: ${article.title}`);
                continue;
              } else if (resolution.action === 'conflict_resolved') {
                syncResults.conflicts_resolved++;
                console.log(`✓ Resolved WordPress ID conflict for: ${article.title}`);
              } else if (resolution.action === 'error') {
                syncResults.errors.push(`Article "${article.title}": ${resolution.error}`);
                syncResults.errorDetails.push({
                  articleId: article.id,
                  articleTitle: article.title,
                  errorType: 'merge_error',
                  error: resolution.error,
                  timestamp: new Date().toISOString()
                });
                continue;
              }
            }
          }

          // Handle author using simplified approach
          const authorData = wpPost._embedded?.author?.[0];
          if (authorData && wpPost.author) {
            authorId = await handleAuthor(supabase, wpPost.author, authorData);
          }

        } else {
          // For WordPress articles, use the article directly
          wpPost = article;
          const authorData = wpPost._embedded?.author?.[0];
          if (authorData && wpPost.author) {
            authorId = await handleAuthor(supabase, wpPost.author, authorData);
          }
        }

        // Parse dates properly from WordPress post
        const publishedDate = new Date(wpPost.date).toISOString().split('T')[0];
        const modifiedDate = wpPost.modified ? new Date(wpPost.modified).toISOString().split('T')[0] : publishedDate;
        
        console.log(`Using published date: ${publishedDate}, modified date: ${modifiedDate}`);
        console.log(`Author assigned: ${authorId || 'none'}`);

        const articleData = {
          wordpress_id: wpPost.id,
          title: wpPost.title.rendered,
          content_variants: {
            wordpress_content: {
              content: wpPost.content.rendered,
              excerpt: wpPost.excerpt.rendered,
              featured_media: wpPost.featured_media,
              categories: wpPost.categories,
              tags: wpPost.tags
            }
          },
          primary_author_id: authorId,
          wordpress_author_id: wpPost.author,
          wordpress_author_name: wpPost._embedded?.author?.[0]?.name || 'Unknown',
          wordpress_categories: wpPost.categories || [],
          wordpress_tags: wpPost.tags || [],
          published_at: publishedDate,
          article_date: publishedDate,
          last_wordpress_sync: new Date().toISOString(),
          status: wpPost.status === 'publish' ? 'published' : 'draft',
          source_system: 'wordpress',
          source_url: wpPost.link || null,
          excerpt: wpPost.excerpt.rendered?.replace(/<[^>]*>/g, '').substring(0, 500) || null,
          updated_at: modifiedDate
        }

        if (targetArticleIds) {
          // Update existing article
          console.log(`Updating existing article: ${article.id}`);
          const { error } = await supabase
            .from('articles')
            .update(articleData)
            .eq('id', article.id)
          
          if (error) {
            console.error('Update error:', error);
            throw error;
          }
          
          syncResults.updated++
          syncResults.matched++
          syncResults.matchDetails.push({
            wordpress_id: wpPost.id,
            article_id: article.id,
            match_type: 'selected_article',
            confidence: 1.0,
            title: article.title
          })
          
          console.log(`✓ Updated article: ${article.title}`)
        } else {
          // Create new article (original behavior)
          console.log(`Creating new article...`);
          const { error } = await supabase
            .from('articles')
            .insert(articleData)
          
          if (error) {
            console.error('Insert error:', error);
            throw error;
          }
          
          syncResults.created++
          console.log(`✓ Created new article: ${wpPost.title.rendered}`)
        }

      } catch (error) {
        console.error(`Error processing article:`, error)
        const errorMsg = `Article "${article.title || article.id}": ${error.message}`;
        syncResults.errors.push(errorMsg);
        syncResults.errorDetails.push({
          articleId: article.id,
          articleTitle: article.title || 'Unknown',
          errorType: 'processing_error',
          error: error.message,
          timestamp: new Date().toISOString(),
          stack: error.stack
        });
      }
    }

    // Update sync operation with final results
    if (syncOpId) {
      await supabase
        .from('sync_operations')
        .update({
          status: 'completed',
          completed_items: syncResults.processed,
          results_summary: {
            processed: syncResults.processed,
            created: syncResults.created,
            updated: syncResults.updated,
            matched: syncResults.matched,
            merged: syncResults.merged,
            conflicts_resolved: syncResults.conflicts_resolved,
            skipped: syncResults.skipped,
            total_errors: syncResults.errors.length
          },
          error_details: syncResults.errorDetails,
          merge_decisions: syncResults.mergeDecisions
        })
        .eq('id', syncOpId);
    }

    console.log(`\n=== Enhanced sync completed ===`);
    console.log(`Processed: ${syncResults.processed}`);
    console.log(`Created: ${syncResults.created}`);
    console.log(`Updated: ${syncResults.updated}`);
    console.log(`Matched: ${syncResults.matched}`);
    console.log(`Merged: ${syncResults.merged}`);
    console.log(`Conflicts resolved: ${syncResults.conflicts_resolved}`);
    console.log(`Skipped: ${syncResults.skipped}`);
    console.log(`Errors: ${syncResults.errors.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: syncResults,
        totalArticles: articlesToProcess.length,
        syncOperationId: syncOpId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Enhanced WordPress sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
