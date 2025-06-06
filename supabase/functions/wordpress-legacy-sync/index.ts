
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

// SIMPLIFIED: Map WordPress author ID to our system author using existing data
async function mapWordPressAuthor(wpAuthorId: number, supabase: any): Promise<{ authorId: string | null; authorName: string | null }> {
  console.log(`\n🔍 SIMPLE AUTHOR MAPPING for WordPress ID: ${wpAuthorId}`);
  
  try {
    // Look up author by WordPress ID in our authors table
    const { data: author, error } = await supabase
      .from('authors')
      .select('id, name, wordpress_author_id, wordpress_author_name')
      .eq('wordpress_author_id', wpAuthorId)
      .maybeSingle();

    if (error) {
      console.error('❌ Database lookup error:', error);
      return { authorId: null, authorName: null };
    }

    if (author) {
      console.log(`✅ Found mapped author: "${author.name}" (ID: ${author.id})`);
      return { authorId: author.id, authorName: author.name };
    } else {
      console.log(`⚠️ No author mapping found for WordPress ID ${wpAuthorId}`);
      return { authorId: null, authorName: null };
    }
  } catch (error) {
    console.error('❌ Error in author mapping:', error);
    return { authorId: null, authorName: null };
  }
}

// Add delay for API rate limiting
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check for existing article by WordPress ID
async function checkWordPressIdConflict(supabase: any, wordpressId: number): Promise<any> {
  console.log(`🔍 Checking for existing article with WordPress ID: ${wordpressId}`);
  
  const { data: existingArticle, error } = await supabase
    .from('articles')
    .select('id, title, wordpress_id, primary_author_id')
    .eq('wordpress_id', wordpressId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error checking for existing article:', error);
    return null;
  }

  if (existingArticle) {
    console.log(`✅ Found existing article: "${existingArticle.title}" (ID: ${existingArticle.id})`);
    console.log(`   Current author ID: ${existingArticle.primary_author_id || 'NOT SET'}`);
  } else {
    console.log(`ℹ️ No existing article found for WordPress ID ${wordpressId}`);
  }

  return existingArticle;
}

// Bulk update function to fix existing unmapped articles
async function bulkUpdateUnmappedArticles(supabase: any): Promise<{ updated: number; errors: string[] }> {
  console.log('\n🔧 Starting bulk update of unmapped articles...');
  
  // Find articles with WordPress author ID but no primary author ID
  const { data: unmappedArticles, error: fetchError } = await supabase
    .from('articles')
    .select('id, wordpress_author_id, title')
    .not('wordpress_author_id', 'is', null)
    .is('primary_author_id', null)
    .limit(100); // Process in batches

  if (fetchError) {
    console.error('❌ Error fetching unmapped articles:', fetchError);
    return { updated: 0, errors: [fetchError.message] };
  }

  if (!unmappedArticles || unmappedArticles.length === 0) {
    console.log('ℹ️ No unmapped articles found');
    return { updated: 0, errors: [] };
  }

  console.log(`📊 Found ${unmappedArticles.length} unmapped articles to process`);
  
  let updated = 0;
  const errors: string[] = [];

  for (const article of unmappedArticles) {
    try {
      const { authorId, authorName } = await mapWordPressAuthor(article.wordpress_author_id, supabase);
      
      if (authorId) {
        const { error: updateError } = await supabase
          .from('articles')
          .update({ 
            primary_author_id: authorId,
            wordpress_author_name: authorName 
          })
          .eq('id', article.id);

        if (updateError) {
          errors.push(`Failed to update article "${article.title}": ${updateError.message}`);
        } else {
          updated++;
          console.log(`✅ Updated article "${article.title}" with author "${authorName}"`);
        }
      } else {
        console.log(`⚠️ Skipping article "${article.title}" - no author mapping found`);
      }
    } catch (error) {
      errors.push(`Error processing article "${article.title}": ${error.message}`);
    }
  }

  console.log(`🎯 Bulk update complete: ${updated} articles updated, ${errors.length} errors`);
  return { updated, errors };
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
        mode: 'update',
        dryRun: false
      },
      bulkUpdateUnmapped = false // New option to trigger bulk update
    } = await req.json().catch(() => ({}))

    console.log(`Starting ${duplicateHandling.dryRun ? 'dry run' : 'sync'} WordPress sync`)
    console.log(`Duplicate handling mode: ${duplicateHandling.mode}`)
    console.log(`Processing options:`, processingOptions)
    console.log(`Legacy mode enabled: ${legacyMode}`)

    // Handle bulk update of unmapped articles if requested
    if (bulkUpdateUnmapped) {
      console.log('🔧 Bulk update mode requested');
      const bulkResult = await bulkUpdateUnmappedArticles(supabase);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          operation: 'bulk_update',
          results: {
            updated: bulkResult.updated,
            errors: bulkResult.errors
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

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
      authorsMapped: 0,
      errors: [],
      matchDetails: [],
      mergeDecisions: [],
      errorDetails: []
    }

    let articlesToProcess = [];

    // Handle different sync modes
    if (targetArticleIds && targetArticleIds.length > 0) {
      console.log(`Fetching ${targetArticleIds.length} specific articles for manual sync...`);
      
      // Get WordPress IDs for the target articles
      const { data: targetArticles, error: targetError } = await supabase
        .from('articles')
        .select('id, wordpress_id, title')
        .in('id', targetArticleIds)
        .not('wordpress_id', 'is', null);

      if (targetError) {
        throw new Error(`Failed to get target articles: ${targetError.message}`);
      }

      if (!targetArticles || targetArticles.length === 0) {
        console.log('No articles found with WordPress IDs for the provided target IDs');
        articlesToProcess = [];
      } else {
        console.log(`Found ${targetArticles.length} articles with WordPress IDs to sync`);
        
        // Fetch each WordPress post individually with embedded author data
        for (const article of targetArticles) {
          try {
            console.log(`Fetching WordPress post ${article.wordpress_id} for article "${article.title}"`);
            
            const wpResponse = await fetch(`${wordpressUrl}/wp-json/wp/v2/posts/${article.wordpress_id}?_embed`, {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
              }
            });

            if (wpResponse.ok) {
              const wpPost = await wpResponse.json();
              articlesToProcess.push(wpPost);
              console.log(`✓ Successfully fetched WordPress post for "${article.title}"`);
            } else {
              console.log(`❌ WordPress API returned ${wpResponse.status} for post ${article.wordpress_id}`);
            }

            // Add delay to respect API rate limits
            if (performanceOptions.apiDelay > 0) {
              await delay(performanceOptions.apiDelay);
            }
          } catch (error) {
            console.error(`Error fetching WordPress post ${article.wordpress_id}:`, error);
          }
        }
      }
    } else {
      // Fetch from WordPress with enhanced field selection and _embed for author data
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

    console.log(`Processing ${articlesToProcess.length} articles using simplified mapping...`)

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
          console.log(`📋 DUPLICATE ANALYSIS:`);
          console.log(`  - Existing article ID: ${existingArticle.id}`);
          console.log(`  - Current author: ${existingArticle.primary_author_id || 'NONE'}`);
          console.log(`  - Duplicate handling mode: ${duplicateHandling.mode}`);
          
          if (duplicateHandling.mode === 'skip') {
            syncResults.skipped++;
            console.log(`⏭️ Skipping duplicate: "${wpPost.title.rendered}"`);
            continue;
          } else if (duplicateHandling.mode === 'update' || duplicateHandling.mode === 'both') {
            console.log(`🔄 Will update existing article: "${existingArticle.title}"`);
          }
        }

        // Parse dates properly from WordPress post (CST timezone)
        const publishedDate = convertWordPressToCst(wpPost.date);
        const modifiedDate = wpPost.modified ? convertWordPressToCst(wpPost.modified) : publishedDate;
        
        console.log(`📅 Using CST dates - published: ${publishedDate}, modified: ${modifiedDate}`);

        // SIMPLIFIED AUTHOR MAPPING using our existing data
        console.log(`\n🔄 Starting simplified author mapping for article "${wpPost.title?.rendered}"`);
        const { authorId, authorName } = await mapWordPressAuthor(wpPost.author, supabase);
        
        if (authorId) {
          syncResults.authorsMapped++;
        }
        
        console.log(`\n📊 AUTHOR MAPPING RESULT:`);
        console.log(`  - Author ID: ${authorId || 'NOT MAPPED'}`);
        console.log(`  - Author Name: "${authorName || 'NOT MAPPED'}"`);
        console.log(`  - WordPress Author ID: ${wpPost.author}`);

        // Prepare article data with simplified author assignment
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
          wordpress_author_id: parseInt(wpPost.author.toString()),
          primary_author_id: authorId,
          wordpress_author_name: authorName || 'Unknown',
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

        console.log(`\n📝 FINAL ARTICLE DATA AUTHOR FIELDS:`);
        console.log(`  - primary_author_id: ${articleData.primary_author_id || 'NULL'}`);
        console.log(`  - wordpress_author_name: "${articleData.wordpress_author_name}"`);
        console.log(`  - wordpress_author_id: ${articleData.wordpress_author_id}`);

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
            console.log(`🔄 Updating existing article: ${existingArticle.id}`);
            console.log(`📝 BEFORE UPDATE - Current author: ${existingArticle.primary_author_id || 'NONE'}`);
            console.log(`📝 WILL SET author to: ${articleData.primary_author_id || 'NONE'}`);
            
            const { error } = await supabase
              .from('articles')
              .update(articleData)
              .eq('id', existingArticle.id)
            
            if (error) {
              console.error('❌ Update error:', error);
              throw error;
            }
            
            syncResults.updated++
            syncResults.matched++
            articleId = existingArticle.id;
            console.log(`✅ Updated article: ${existingArticle.title}`)
            
            // POST-UPDATE VERIFICATION
            const { data: verifyArticle } = await supabase
              .from('articles')
              .select('primary_author_id, wordpress_author_name')
              .eq('id', existingArticle.id)
              .single();
            
            console.log(`\n🔍 POST-UPDATE VERIFICATION:`);
            console.log(`  - Article ID: ${existingArticle.id}`);
            console.log(`  - Author ID now: ${verifyArticle?.primary_author_id || 'STILL NULL'}`);
            console.log(`  - Author name now: "${verifyArticle?.wordpress_author_name || 'STILL EMPTY'}"`);
            
            if (verifyArticle?.primary_author_id) {
              console.log(`✅ VERIFICATION SUCCESS: Author successfully assigned!`);
            } else {
              console.log(`❌ VERIFICATION FAILED: Author assignment did not work`);
            }
          } else if (!existingArticle) {
            // Create new article
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
            
            // Verification
            if (articleData.primary_author_id) {
              console.log(`✓ VERIFICATION: Author successfully assigned: ${articleData.wordpress_author_name} (ID: ${articleData.primary_author_id})`);
            } else {
              console.log(`❌ VERIFICATION: Author assignment incomplete`);
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
            authorsMapped: syncResults.authorsMapped,
            total_errors: syncResults.errors.length,
            dry_run: duplicateHandling.dryRun,
            legacy_mode: legacyMode
          },
          error_details: syncResults.errorDetails,
          merge_decisions: syncResults.mergeDecisions
        })
        .eq('id', syncOpId);
    }

    const operation = duplicateHandling.dryRun ? 'dry run analysis' : 'simplified sync';
    console.log(`\n=== ${operation} completed ===`);
    console.log(`Processed: ${syncResults.processed}`);
    console.log(`Created: ${syncResults.created}`);
    console.log(`Updated: ${syncResults.updated}`);
    console.log(`Skipped duplicates: ${syncResults.skipped}`);
    console.log(`Duplicates found: ${syncResults.duplicatesFound}`);
    console.log(`Authors mapped: ${syncResults.authorsMapped}`);
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
    console.error('Simplified WordPress sync error:', error)
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
