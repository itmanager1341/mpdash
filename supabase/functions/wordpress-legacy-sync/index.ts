
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

// Convert WordPress date to CST (our default timezone)
function convertWordPressToCst(wpDate: string): string {
  try {
    // WordPress dates are typically in CST already, so we just need to ensure proper formatting
    const date = new Date(wpDate);
    // Convert to CST by adjusting for timezone offset
    // CST is UTC-6, so we subtract 6 hours from UTC
    const cstDate = new Date(date.getTime() - (6 * 60 * 60 * 1000));
    return cstDate.toISOString().split('T')[0];
  } catch (error) {
    console.error('Date conversion error:', error);
    return new Date().toISOString().split('T')[0];
  }
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
  
  if (norm1 === norm2) {
    return 1.0;
  }
  
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.95;
  }
  
  const words1 = new Set(norm1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(norm2.split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  const similarity = intersection.size / union.size;
  
  return similarity;
}

// Check for existing WordPress ID conflicts
async function checkWordPressIdConflict(supabase: any, wpId: number, currentArticleId: string | null = null) {
  let query = supabase
    .from('articles')
    .select('id, title, published_at')
    .eq('wordpress_id', wpId);
    
  if (currentArticleId) {
    query = query.neq('id', currentArticleId);
  }
  
  const { data: existingArticle } = await query.maybeSingle();
  return existingArticle;
}

// Simplified author handling
async function handleAuthor(supabase: any, wpAuthorId: number, wpAuthorData: any) {
  if (!wpAuthorData || !wpAuthorId) {
    return null;
  }

  const { data: existingAuthor } = await supabase
    .from('authors')
    .select('id, name')
    .eq('wordpress_author_id', wpAuthorId)
    .maybeSingle();

  if (existingAuthor) {
    return existingAuthor.id;
  }

  const { data: authorByName } = await supabase
    .from('authors')
    .select('id, name, wordpress_author_id')
    .ilike('name', wpAuthorData.name)
    .maybeSingle();

  if (authorByName && !authorByName.wordpress_author_id) {
    const { error: updateError } = await supabase
      .from('authors')
      .update({
        wordpress_author_id: wpAuthorId,
        wordpress_author_name: wpAuthorData.name
      })
      .eq('id', authorByName.id);

    if (!updateError) {
      return authorByName.id;
    }
  }

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

  return newAuthor.id;
}

// Add delay for API rate limiting
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      },
      duplicateHandling = {
        mode: 'skip', // 'skip', 'update', 'both'
        dryRun: false
      }
    } = await req.json().catch(() => ({}))

    console.log(`Starting ${duplicateHandling.dryRun ? 'dry run' : 'enhanced'} WordPress sync`)
    console.log(`Duplicate handling mode: ${duplicateHandling.mode}`)
    console.log(`Processing options:`, processingOptions)

    // Create sync operation record
    const { data: syncOperation, error: syncOpError } = await supabase
      .from('sync_operations')
      .insert({
        operation_type: targetArticleIds ? 'selected_article_sync' : 'wordpress_import',
        total_items: targetArticleIds ? targetArticleIds.length : 0,
        status: duplicateHandling.dryRun ? 'dry_run' : 'running'
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
      duplicatesFound: 0,
      contentExtracted: 0,
      wordCountsCalculated: 0,
      articlesChunked: 0,
      errors: [],
      matchDetails: [],
      mergeDecisions: [],
      errorDetails: []
    }

    let articlesToProcess = [];

    // Fetch from WordPress with optimized field selection and batching
    if (!targetArticleIds) {
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
    const duplicateChecks = [];

    for (let i = 0; i < articlesToProcess.length; i++) {
      const wpPost = articlesToProcess[i];
      
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

        // Check for existing article by WordPress ID
        const existingArticle = await checkWordPressIdConflict(supabase, wpPost.id);
        
        if (existingArticle) {
          syncResults.duplicatesFound++;
          console.log(`Duplicate found: WordPress ID ${wpPost.id} already exists as article ${existingArticle.id}`);
          
          if (duplicateHandling.mode === 'skip') {
            syncResults.skipped++;
            console.log(`Skipping duplicate: "${wpPost.title.rendered}"`);
            continue;
          } else if (duplicateHandling.mode === 'update' || duplicateHandling.mode === 'both') {
            console.log(`Will update existing article: "${existingArticle.title}"`);
          }
        }

        // Handle author
        const authorData = wpPost._embedded?.author?.[0];
        let authorId = null;
        if (authorData && wpPost.author) {
          authorId = await handleAuthor(supabase, wpPost.author, authorData);
        }

        // Parse dates properly from WordPress post (CST timezone)
        const publishedDate = convertWordPressToCst(wpPost.date);
        const modifiedDate = wpPost.modified ? convertWordPressToCst(wpPost.modified) : publishedDate;
        
        console.log(`Using CST dates - published: ${publishedDate}, modified: ${modifiedDate}`);

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

        let articleId = null;

        if (duplicateHandling.dryRun) {
          // Dry run - just track what would happen
          if (existingArticle) {
            if (duplicateHandling.mode === 'update' || duplicateHandling.mode === 'both') {
              syncResults.updated++;
              console.log(`[DRY RUN] Would update: "${existingArticle.title}"`);
            } else {
              syncResults.skipped++;
              console.log(`[DRY RUN] Would skip: "${wpPost.title.rendered}"`);
            }
          } else {
            syncResults.created++;
            console.log(`[DRY RUN] Would create: "${wpPost.title.rendered}"`);
          }
        } else {
          // Actual processing
          if (existingArticle && (duplicateHandling.mode === 'update' || duplicateHandling.mode === 'both')) {
            // Update existing article
            console.log(`Updating existing article: ${existingArticle.id}`);
            const { error } = await supabase
              .from('articles')
              .update(articleData)
              .eq('id', existingArticle.id)
            
            if (error) {
              console.error('Update error:', error);
              throw error;
            }
            
            syncResults.updated++
            syncResults.matched++
            articleId = existingArticle.id;
            console.log(`✓ Updated article: ${existingArticle.title}`)
          } else if (!existingArticle) {
            // Create new article
            articleData.title = decodeHtmlEntities(wpPost.title.rendered);
            console.log(`Creating new article: "${articleData.title}"`);
            
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
          } else {
            // Skip duplicate
            syncResults.skipped++;
            console.log(`✓ Skipped duplicate: "${wpPost.title.rendered}"`)
            continue;
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
        }

      } catch (error) {
        console.error(`Error processing article:`, error)
        const errorMsg = `Article "${wpPost.title?.rendered || wpPost.id}": ${error.message}`;
        syncResults.errors.push(errorMsg);
        syncResults.errorDetails.push({
          articleId: wpPost.id,
          articleTitle: wpPost.title?.rendered || 'Unknown',
          errorType: 'processing_error',
          error: error.message,
          timestamp: new Date().toISOString(),
          stack: error.stack
        });
      }
    }

    // Process chunking in background if enabled and not dry run
    if (!duplicateHandling.dryRun && processingOptions.autoChunkArticles && articleIdsForProcessing.length > 0) {
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
          status: duplicateHandling.dryRun ? 'dry_run_completed' : 'completed',
          completed_items: syncResults.processed,
          results_summary: {
            processed: syncResults.processed,
            created: syncResults.created,
            updated: syncResults.updated,
            matched: syncResults.matched,
            merged: syncResults.merged,
            conflicts_resolved: syncResults.conflicts_resolved,
            skipped: syncResults.skipped,
            duplicatesFound: syncResults.duplicatesFound,
            contentExtracted: syncResults.contentExtracted,
            wordCountsCalculated: syncResults.wordCountsCalculated,
            articlesChunked: syncResults.articlesChunked,
            total_errors: syncResults.errors.length,
            dry_run: duplicateHandling.dryRun
          },
          error_details: syncResults.errorDetails,
          merge_decisions: syncResults.mergeDecisions
        })
        .eq('id', syncOpId);
    }

    const operation = duplicateHandling.dryRun ? 'dry run analysis' : 'enhanced sync';
    console.log(`\n=== ${operation} completed ===`);
    console.log(`Processed: ${syncResults.processed}`);
    console.log(`Created: ${syncResults.created}`);
    console.log(`Updated: ${syncResults.updated}`);
    console.log(`Skipped duplicates: ${syncResults.skipped}`);
    console.log(`Duplicates found: ${syncResults.duplicatesFound}`);
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
