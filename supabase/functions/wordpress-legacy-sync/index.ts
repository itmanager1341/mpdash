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
    // WordPress dates are in CST already, just ensure proper ISO format
    const date = new Date(wpDate);
    return date.toISOString().split('T')[0];
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

// Enhanced author handling with database-first approach
async function handleAuthor(supabase: any, wpAuthorId: number): Promise<{ authorId: string | null; authorName: string | null }> {
  if (!wpAuthorId) {
    console.log('No WordPress author ID provided');
    return { authorId: null, authorName: null };
  }

  console.log(`\n=== Author Resolution for WordPress Author ID ${wpAuthorId} ===`);

  // PRIORITY 1: Check database for existing author by WordPress ID
  console.log(`Step 1: Database lookup for wordpress_author_id=${wpAuthorId}...`);
  const { data: existingAuthor, error: existingAuthorError } = await supabase
    .from('authors')
    .select('id, name, wordpress_author_id')
    .eq('wordpress_author_id', wpAuthorId)
    .maybeSingle();

  if (existingAuthorError) {
    console.error('Database lookup error:', existingAuthorError);
    return { authorId: null, authorName: null };
  }

  if (existingAuthor) {
    console.log(`✓ Found existing author in database: "${existingAuthor.name}" (ID: ${existingAuthor.id})`);
    console.log(`✓ Returning database author - ID: ${existingAuthor.id}, Name: "${existingAuthor.name}"`);
    return { authorId: existingAuthor.id, authorName: existingAuthor.name };
  }

  console.log(`No existing author found for WordPress ID ${wpAuthorId}`);

  // PRIORITY 2: Try WordPress API lookup only if not in database
  console.log(`Step 2: WordPress API lookup for author ${wpAuthorId}...`);
  
  const wordpressUrl = Deno.env.get('WORDPRESS_URL');
  const username = Deno.env.get('WORDPRESS_USERNAME');
  const password = Deno.env.get('WORDPRESS_PASSWORD');
  
  let authorData = null;
  
  if (wordpressUrl && username && password) {
    try {
      const auth = btoa(`${username}:${password}`);
      const authorResponse = await fetch(`${wordpressUrl}/wp-json/wp/v2/users/${wpAuthorId}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (authorResponse.ok) {
        authorData = await authorResponse.json();
        console.log(`✓ Fetched author data from WordPress API: ${authorData.name}`);
      } else {
        console.log(`WordPress API returned ${authorResponse.status} for author ${wpAuthorId}`);
      }
    } catch (error) {
      console.error(`Failed to fetch author ${wpAuthorId} from WordPress API:`, error);
    }
  }

  if (!authorData || !authorData.name) {
    console.log(`❌ No author data available for WordPress author ID ${wpAuthorId}`);
    return { authorId: null, authorName: null };
  }

  // PRIORITY 3: Check if author exists by name and update with WordPress ID
  console.log(`Step 3: Checking for author by name: "${authorData.name}"`);
  const { data: authorByName } = await supabase
    .from('authors')
    .select('id, name, wordpress_author_id')
    .ilike('name', authorData.name)
    .maybeSingle();

  if (authorByName && !authorByName.wordpress_author_id) {
    console.log(`✓ Found author by name, updating with WordPress ID: ${authorByName.name}`);
    const { error: updateError } = await supabase
      .from('authors')
      .update({
        wordpress_author_id: wpAuthorId,
        wordpress_author_name: authorData.name
      })
      .eq('id', authorByName.id);

    if (!updateError) {
      console.log(`✓ Successfully updated author ${authorByName.name} with WordPress ID ${wpAuthorId}`);
      return { authorId: authorByName.id, authorName: authorByName.name };
    } else {
      console.error('Error updating author with WordPress ID:', updateError);
    }
  }

  // PRIORITY 4: Create new author if none exists
  console.log(`Step 4: Creating new author: ${authorData.name}`);
  const { data: newAuthor, error: authorError } = await supabase
    .from('authors')
    .insert({
      name: authorData.name,
      author_type: 'external',
      email: authorData.email || null,
      bio: authorData.description || null,
      wordpress_author_id: wpAuthorId,
      wordpress_author_name: authorData.name,
      is_active: true
    })
    .select('id, name')
    .single();

  if (authorError) {
    console.error('Error creating author:', authorError);
    return { authorId: null, authorName: null };
  }

  console.log(`✓ Created new author: ${newAuthor.name} with ID ${newAuthor.id}`);
  return { authorId: newAuthor.id, authorName: newAuthor.name };
}

// Simplified author assignment function
async function ensureAuthorAssignment(supabase: any, articleData: any) {
  if (!articleData.wordpress_author_id) {
    console.log('No WordPress author ID available for assignment');
    return articleData;
  }

  console.log(`\n--- Author Assignment for Article "${articleData.title}" ---`);
  console.log(`WordPress Author ID: ${articleData.wordpress_author_id}`);
  
  const { authorId, authorName } = await handleAuthor(supabase, articleData.wordpress_author_id);
  
  if (authorId && authorName) {
    articleData.primary_author_id = authorId;
    articleData.wordpress_author_name = authorName;
    console.log(`✓ Author assigned successfully:`);
    console.log(`  - Author ID: ${authorId}`);
    console.log(`  - Author Name: "${authorName}"`);
  } else {
    console.log(`❌ Failed to assign author for WordPress Author ID ${articleData.wordpress_author_id}`);
    console.log(`Setting fallback values...`);
    articleData.wordpress_author_name = 'Unknown';
  }
  
  return articleData;
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
        mode: 'skip',
        dryRun: false
      }
    } = await req.json().catch(() => ({}))

    console.log(`Starting ${duplicateHandling.dryRun ? 'dry run' : 'legacy mode'} WordPress sync`)
    console.log(`Duplicate handling mode: ${duplicateHandling.mode}`)
    console.log(`Processing options:`, processingOptions)
    console.log(`Legacy mode enabled: ${legacyMode}`)

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

    // Fetch from WordPress with enhanced field selection and _embed for author data
    if (!targetArticleIds) {
      console.log('Fetching from WordPress API with enhanced batching and author embedding...');
      
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

    console.log(`Processing ${articlesToProcess.length} articles using legacy mode...`)

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
        console.log(`Title: "${wpPost.title?.rendered || 'Unknown'}"`);
        console.log(`WordPress ID: ${wpPost.id}`);
        console.log(`Author ID: ${wpPost.author}`);

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

        // Parse dates properly from WordPress post (CST timezone)
        const publishedDate = convertWordPressToCst(wpPost.date);
        const modifiedDate = wpPost.modified ? convertWordPressToCst(wpPost.modified) : publishedDate;
        
        console.log(`Using CST dates - published: ${publishedDate}, modified: ${modifiedDate}`);

        // Prepare article data with enhanced content processing
        let articleData = {
          wordpress_id: wpPost.id,
          title: decodeHtmlEntities(wpPost.title?.rendered || ''),
          content_variants: {
            wordpress_content: {
              content: wpPost.content?.rendered || '',
              excerpt: wpPost.excerpt?.rendered || '',
              featured_media: wpPost.featured_media,
              categories: wpPost.categories,
              tags: wpPost.tags
            }
          },
          wordpress_author_id: wpPost.author,
          wordpress_categories: wpPost.categories || [],
          wordpress_tags: wpPost.tags || [],
          published_at: publishedDate,
          article_date: publishedDate,
          last_wordpress_sync: new Date().toISOString(),
          status: wpPost.status === 'publish' ? 'published' : 'draft',
          source_system: 'wordpress',
          source_url: wpPost.link || null,
          excerpt: wpPost.excerpt?.rendered?.replace(/<[^>]*>/g, '').substring(0, 500) || null,
          updated_at: modifiedDate
        }

        // CRITICAL: Always ensure author assignment happens FIRST
        articleData = await ensureAuthorAssignment(supabase, articleData);
        
        // Verify author assignment worked
        console.log(`Post-assignment verification:`);
        console.log(`  - primary_author_id: ${articleData.primary_author_id || 'NOT SET'}`);
        console.log(`  - wordpress_author_name: "${articleData.wordpress_author_name || 'NOT SET'}"`);

        // Process content immediately if enabled
        if (processingOptions.autoExtractContent) {
          const { cleanContent, wordCount } = extractCleanContent(wpPost);
          if (cleanContent) {
            articleData.clean_content = cleanContent;
            console.log(`Extracted clean content (${cleanContent.length} chars)`);
            if (processingOptions.autoCalculateWordCount) {
              articleData.word_count = wordCount;
              console.log(`Calculated word count: ${wordCount}`);
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
            console.log(`Final author data being saved:`);
            console.log(`  - primary_author_id: ${articleData.primary_author_id || 'NULL'}`);
            console.log(`  - wordpress_author_name: "${articleData.wordpress_author_name || 'NULL'}"`);
            
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
            
            // Final verification
            if (articleData.primary_author_id && articleData.wordpress_author_name && articleData.wordpress_author_name !== 'Unknown') {
              console.log(`✓ VERIFICATION: Author successfully assigned to existing article: ${articleData.wordpress_author_name} (ID: ${articleData.primary_author_id})`);
            } else {
              console.log(`❌ VERIFICATION FAILED: Author assignment incomplete for existing article`);
            }
          } else if (!existingArticle) {
            // Create new article
            console.log(`Creating new article: "${articleData.title}"`);
            console.log(`Final author data being saved:`);
            console.log(`  - primary_author_id: ${articleData.primary_author_id || 'NULL'}`);
            console.log(`  - wordpress_author_name: "${articleData.wordpress_author_name || 'NULL'}"`);
            
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
            
            // Final verification
            if (articleData.primary_author_id && articleData.wordpress_author_name && articleData.wordpress_author_name !== 'Unknown') {
              console.log(`✓ VERIFICATION: Author successfully assigned to new article: ${articleData.wordpress_author_name} (ID: ${articleData.primary_author_id})`);
            } else {
              console.log(`❌ VERIFICATION FAILED: Author assignment incomplete for new article`);
            }
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
            dry_run: duplicateHandling.dryRun,
            legacy_mode: legacyMode
          },
          error_details: syncResults.errorDetails,
          merge_decisions: syncResults.mergeDecisions
        })
        .eq('id', syncOpId);
    }

    const operation = duplicateHandling.dryRun ? 'dry run analysis' : 'legacy mode sync';
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
    console.error('Legacy mode WordPress sync error:', error)
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
