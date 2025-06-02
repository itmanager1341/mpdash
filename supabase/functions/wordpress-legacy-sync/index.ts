import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Utility functions for content processing
function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateWordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function extractCleanContent(wpPost: any): { cleanContent: string; wordCount: number } {
  const content = wpPost.content?.rendered || '';
  const excerpt = wpPost.excerpt?.rendered || '';
  
  let cleanContent = '';
  if (content) {
    cleanContent = stripHtmlTags(content);
  } else if (excerpt) {
    cleanContent = stripHtmlTags(excerpt);
  }
  
  const wordCount = calculateWordCount(cleanContent);
  
  return { cleanContent, wordCount };
}

// HTML entity decoding function
function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&#8230;': '...',
    '&hellip;': '...',
    '&#8216;': "'",
    '&#8217;': "'",
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&#8220;': '"',
    '&#8221;': '"',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&#8211;': '-',
    '&#8212;': '--',
    '&ndash;': '-',
    '&mdash;': '--',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&#039;': "'",
    '&quot;': '"'
  };
  
  let decoded = text;
  for (const [entity, replacement] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
  }
  
  return decoded;
}

// Enhanced title normalization function
function normalizeTitle(title: string): string {
  let normalized = decodeHtmlEntities(title);
  normalized = normalized.toLowerCase().trim();
  normalized = normalized.replace(/[''`]/g, "'");
  normalized = normalized.replace(/[""]/g, '"');
  normalized = normalized.replace(/[–—]/g, '-');
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/[^\w\s'-]/g, '');
  return normalized;
}

// Enhanced similarity scoring for title matching
function calculateTitleSimilarity(title1: string, title2: string): number {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  
  console.log(`Comparing normalized titles:`);
  console.log(`  Original 1: "${title1}" -> Normalized: "${norm1}"`);
  console.log(`  Original 2: "${title2}" -> Normalized: "${norm2}"`);
  
  if (norm1 === norm2) {
    console.log(`  Result: EXACT MATCH (1.0)`);
    return 1.0;
  }
  
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    console.log(`  Result: SUBSTRING MATCH (0.95)`);
    return 0.95;
  }
  
  const words1 = new Set(norm1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(norm2.split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  const similarity = intersection.size / union.size;
  console.log(`  Result: WORD OVERLAP (${similarity.toFixed(3)}) - ${intersection.size}/${union.size} words match`);
  
  return similarity;
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
  
  const titleSimilarity = calculateTitleSimilarity(currentArticle.title, conflictingArticle.title);
  const currentDate = new Date(currentArticle.published_at || currentArticle.article_date);
  const conflictingDate = new Date(conflictingArticle.published_at);
  const dateDiff = Math.abs(currentDate.getTime() - conflictingDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (titleSimilarity >= 0.95 && dateDiff <= 7) {
    console.log(`Merging duplicate articles - keeping existing article ${conflictingArticle.id}, deleting ${currentArticle.id}`);
    
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
  
  console.log(`Searching WordPress for title: "${title}"`);
  
  const exactSearchQuery = encodeURIComponent(title);
  const exactSearchUrl = `${wordpressUrl}/wp-json/wp/v2/posts?search=${exactSearchQuery}&per_page=10&_embed&_fields=id,title,content,excerpt,author,date,modified,link,categories,tags,featured_media,status`;
  
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

    results.forEach((post: any, index: number) => {
      console.log(`Result ${index + 1}: "${post.title.rendered}" (ID: ${post.id})`);
    });

    let bestMatch = null;
    let bestScore = 0.7;

    for (const post of results) {
      const similarity = calculateTitleSimilarity(title, post.title.rendered);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = { post, similarity };
      }
    }

    if (bestMatch) {
      console.log(`Found WordPress match: "${bestMatch.post.title.rendered}" (confidence: ${bestScore.toFixed(3)})`);
      return bestMatch;
    } else {
      console.log(`No matches above threshold (${0.7}) found`);
    }

    return null;
  } catch (error) {
    console.error('WordPress search error:', error);
    return null;
  }
}

// Simplified author handling
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

  const { data: existingAuthor } = await supabase
    .from('authors')
    .select('id, name')
    .eq('wordpress_author_id', wpAuthorId)
    .maybeSingle();

  if (existingAuthor) {
    console.log(`Found existing author by WordPress ID: ${existingAuthor.name} (${existingAuthor.id})`);
    return existingAuthor.id;
  }

  const { data: authorByName } = await supabase
    .from('authors')
    .select('id, name, wordpress_author_id')
    .ilike('name', wpAuthorData.name)
    .maybeSingle();

  if (authorByName && !authorByName.wordpress_author_id) {
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

// Add delay for API rate limiting
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Background task for post-processing
async function processArticleContent(supabase: any, articleId: string, processingOptions: any) {
  try {
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, content_variants, word_count, is_chunked')
      .eq('id', articleId)
      .single();

    if (fetchError || !article) {
      console.error(`Failed to fetch article ${articleId} for processing:`, fetchError);
      return { success: false, error: fetchError?.message };
    }

    let updates: any = {};
    let processed = { contentExtracted: false, wordCountCalculated: false, chunked: false };

    // Extract content if enabled and content exists
    if (processingOptions.autoExtractContent && article.content_variants?.wordpress_content) {
      const wpContent = article.content_variants.wordpress_content;
      const { cleanContent, wordCount } = extractCleanContent(wpContent);
      
      if (cleanContent) {
        updates.clean_content = cleanContent;
        processed.contentExtracted = true;
        
        if (processingOptions.autoCalculateWordCount) {
          updates.word_count = wordCount;
          processed.wordCountCalculated = true;
        }
      }
    }

    // Update article if we have changes
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('articles')
        .update(updates)
        .eq('id', articleId);

      if (updateError) {
        console.error(`Failed to update article ${articleId}:`, updateError);
        return { success: false, error: updateError.message };
      }
    }

    // Chunk article if enabled and conditions are met
    if (processingOptions.autoChunkArticles && 
        (updates.word_count || article.word_count) > 0 && 
        !article.is_chunked) {
      
      try {
        const { data: chunkData, error: chunkError } = await supabase.functions.invoke('process-article-chunks', {
          body: { articleIds: [articleId] }
        });

        if (!chunkError && chunkData?.processed > 0) {
          processed.chunked = true;
        } else {
          console.error(`Failed to chunk article ${articleId}:`, chunkError || 'No chunks processed');
        }
      } catch (chunkingError) {
        console.error(`Chunking error for article ${articleId}:`, chunkingError);
      }
    }

    return { success: true, processed };
  } catch (error) {
    console.error(`Processing error for article ${articleId}:`, error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
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
      operationId = null,
      processingOptions = {
        autoExtractContent: false,
        autoCalculateWordCount: false,
        autoChunkArticles: false
      },
      performanceOptions = {
        apiDelay: 100,
        batchSize: 20
      }
    } = await req.json().catch(() => ({}))

    console.log(`Starting enhanced WordPress sync with processing pipeline`)
    console.log(`Processing options:`, processingOptions)
    console.log(`Performance options:`, performanceOptions)

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
      contentExtracted: 0,
      wordCountsCalculated: 0,
      articlesChunked: 0,
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
      // Fetch from WordPress with optimized field selection and batching
      console.log('Fetching from WordPress API with enhanced batching...');
      
      const optimizedFields = 'id,title,content,excerpt,author,date,modified,link,categories,tags,featured_media,status';
      let wpApiUrl = `${wordpressUrl}/wp-json/wp/v2/posts?per_page=${performanceOptions.batchSize}&_embed&_fields=${optimizedFields}`
      if (startDate) wpApiUrl += `&after=${startDate}T00:00:00`
      if (endDate) wpApiUrl += `&before=${endDate}T23:59:59`
      
      let allArticles = []
      let page = 1
      let totalFetched = 0
      
      while (totalFetched < maxArticles) {
        const remainingArticles = maxArticles - totalFetched
        const perPage = Math.min(remainingArticles, performanceOptions.batchSize)
        
        let currentUrl = wpApiUrl.replace(/per_page=\d+/, `per_page=${perPage}`)
        if (page > 1) currentUrl += `&page=${page}`
        
        console.log(`Fetching page ${page} with ${perPage} articles...`);
        
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
        
        // Add delay between API calls to reduce WPEngine load
        if (performanceOptions.apiDelay > 0 && wpArticles.length === perPage) {
          console.log(`Adding ${performanceOptions.apiDelay}ms delay before next batch...`);
          await delay(performanceOptions.apiDelay);
        }
        
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

    // Store article IDs for background processing
    const articleIdsForProcessing = [];

    for (let i = 0; i < articlesToProcess.length; i++) {
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
          // Database article processing logic
          console.log(`Database article: "${article.title}"`);
          console.log(`Published: ${article.published_at}, WP ID: ${article.wordpress_id || 'none'}`);

          if (article.wordpress_id) {
            try {
              const wpResponse = await fetch(`${wordpressUrl}/wp-json/wp/v2/posts/${article.wordpress_id}?_embed&_fields=id,title,content,excerpt,author,date,modified,link,categories,tags,featured_media,status`, {
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
            const searchResult = await searchWordPressPostByTitle(article.title, wordpressUrl, auth);
            if (searchResult) {
              wpPost = searchResult.post;
              console.log(`Found WordPress post by enhanced title search: ${wpPost.id} (similarity: ${searchResult.similarity.toFixed(3)})`);
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

        // Prepare article data with enhanced content processing
        const articleData = {
          wordpress_id: wpPost.id,
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

        // Process content immediately if enabled
        if (processingOptions.autoExtractContent) {
          const { cleanContent, wordCount } = extractCleanContent(wpPost);
          if (cleanContent) {
            articleData.clean_content = cleanContent;
            if (processingOptions.autoCalculateWordCount) {
              articleData.word_count = wordCount;
            }
          }
        }

        // Only include title for new articles (from WordPress import), not for existing article updates
        if (!targetArticleIds) {
          articleData.title = decodeHtmlEntities(wpPost.title.rendered);
          console.log(`Using decoded WordPress title for new article: "${articleData.title}"`);
        } else {
          console.log(`Preserving existing database title: "${article.title}" (WordPress title: "${wpPost.title.rendered}")`);
        }

        let articleId = null;

        if (targetArticleIds) {
          // Update existing article without changing the title
          console.log(`Updating existing article: ${article.id} (preserving title: "${article.title}")`);
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
          
          articleId = article.id;
          console.log(`✓ Updated article: ${article.title} (title preserved)`)
        } else {
          // Create new article
          console.log(`Creating new article with title: "${articleData.title}"`);
          const { data: insertedArticle, error } = await supabase
            .from('articles')
            .insert(articleData)
            .select('id')
            .single()
          
          if (error) {
            console.error('Insert error:', error);
            throw error;
          }
          
          syncResults.created++
          articleId = insertedArticle.id;
          console.log(`✓ Created new article: ${articleData.title}`)
        }

        // Track content processing results
        if (processingOptions.autoExtractContent && articleData.clean_content) {
          syncResults.contentExtracted++;
        }
        if (processingOptions.autoCalculateWordCount && articleData.word_count) {
          syncResults.wordCountsCalculated++;
        }

        // Queue for chunking if enabled
        if (processingOptions.autoChunkArticles && articleId && articleData.word_count > 0) {
          articleIdsForProcessing.push(articleId);
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

    // Process chunking in background if enabled
    if (processingOptions.autoChunkArticles && articleIdsForProcessing.length > 0) {
      console.log(`Starting chunking for ${articleIdsForProcessing.length} articles...`);
      
      try {
        const { data: chunkData, error: chunkError } = await supabase.functions.invoke('process-article-chunks', {
          body: { 
            articleIds: articleIdsForProcessing,
            limit: articleIdsForProcessing.length
          }
        });

        if (!chunkError && chunkData?.processed > 0) {
          syncResults.articlesChunked = chunkData.processed;
          console.log(`✓ Successfully chunked ${chunkData.processed} articles`);
        } else {
          console.error('Chunking error:', chunkError);
          syncResults.errors.push(`Chunking failed: ${chunkError?.message || 'Unknown error'}`);
        }
      } catch (chunkingError) {
        console.error('Chunking invocation error:', chunkingError);
        syncResults.errors.push(`Chunking failed: ${chunkingError.message}`);
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
            contentExtracted: syncResults.contentExtracted,
            wordCountsCalculated: syncResults.wordCountsCalculated,
            articlesChunked: syncResults.articlesChunked,
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
    console.log(`Content extracted: ${syncResults.contentExtracted}`);
    console.log(`Word counts calculated: ${syncResults.wordCountsCalculated}`);
    console.log(`Articles chunked: ${syncResults.articlesChunked}`);
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
