
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

// Enhanced duplicate checking with proper date range filtering
async function findExistingArticle(supabase: any, wpArticle: any, startDate?: string, endDate?: string) {
  console.log(`Checking for duplicates of WP article ${wpArticle.id}: "${wpArticle.title.rendered}"`);
  
  // First check by WordPress ID (for already synced articles)
  if (wpArticle.id) {
    const { data: existingByWpId } = await supabase
      .from('articles')
      .select('id, title, wordpress_id')
      .eq('wordpress_id', wpArticle.id)
      .maybeSingle();
    
    if (existingByWpId) {
      console.log(`Found existing article with WP ID ${wpArticle.id}: ${existingByWpId.title}`);
      return { 
        match: existingByWpId, 
        matchType: 'wordpress_id', 
        confidence: 1.0,
        action: 'update'
      };
    }
  }

  const wpTitle = wpArticle.title.rendered?.trim();
  const wpPublishDate = new Date(wpArticle.date).toISOString().split('T')[0];
  
  if (!wpTitle || wpTitle.length < 10) {
    console.log(`Skipping similarity check - title too short: "${wpTitle}"`);
    return null;
  }

  console.log(`WP article publish date: ${wpPublishDate}`);

  // Only check for duplicates outside the requested date range to avoid false positives
  let dateQuery = supabase
    .from('articles')
    .select('id, title, published_at, article_date, wordpress_id')
    .is('wordpress_id', null);

  // If we have a date range filter, only check articles outside that range for duplicates
  if (startDate && endDate) {
    console.log(`Date range filter: ${startDate} to ${endDate}`);
    // Check articles published before start date or after end date
    dateQuery = dateQuery.or(`published_at.lt.${startDate},published_at.gt.${endDate}`);
  }

  const { data: candidates } = await dateQuery.limit(50);

  if (!candidates || candidates.length === 0) {
    console.log('No candidates found for similarity matching');
    return null;
  }

  console.log(`Found ${candidates.length} candidates for similarity matching`);

  let bestMatch = null;
  let bestScore = 0.85; // Higher threshold to reduce false positives

  for (const candidate of candidates) {
    const similarity = calculateTitleSimilarity(wpTitle, candidate.title);
    
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = candidate;
      console.log(`High similarity match found: ${similarity.toFixed(3)} - "${candidate.title}"`);
    }
  }

  if (bestMatch) {
    return {
      match: bestMatch,
      matchType: 'title_similarity',
      confidence: bestScore,
      action: 'update'
    };
  }

  console.log('No duplicate found - article is unique');
  return null;
}

// Enhanced author creation and mapping
async function handleAuthor(supabase: any, wpArticle: any) {
  const authorData = wpArticle._embedded?.author?.[0];
  console.log(`Processing author for article ${wpArticle.id}:`, {
    wordpress_author_id: wpArticle.author,
    author_data: authorData ? {
      name: authorData.name,
      slug: authorData.slug,
      description: authorData.description
    } : 'No embedded author data'
  });

  if (!authorData || !wpArticle.author) {
    console.log('No author data available');
    return null;
  }

  // Check existing WordPress author mapping
  const { data: existingMapping } = await supabase
    .from('wordpress_author_mapping')
    .select(`
      system_author_id,
      authors (
        id,
        name,
        author_type
      )
    `)
    .eq('wordpress_author_id', wpArticle.author)
    .maybeSingle();

  if (existingMapping?.system_author_id) {
    console.log(`Found existing author mapping: ${existingMapping.system_author_id}`);
    return existingMapping.system_author_id;
  }

  // Try to find existing author by name (case-insensitive)
  const { data: existingAuthor } = await supabase
    .from('authors')
    .select('id, name')
    .ilike('name', authorData.name)
    .maybeSingle();

  if (existingAuthor) {
    console.log(`Found existing author by name: ${existingAuthor.name} (${existingAuthor.id})`);
    
    // Create mapping
    const { error: mappingError } = await supabase
      .from('wordpress_author_mapping')
      .upsert({
        wordpress_author_id: wpArticle.author,
        wordpress_author_name: authorData.name,
        system_author_id: existingAuthor.id,
        mapping_confidence: 1.0,
        is_verified: true
      });

    if (mappingError) {
      console.error('Error creating author mapping:', mappingError);
    }

    return existingAuthor.id;
  }

  // Create new author
  console.log(`Creating new author: ${authorData.name}`);
  const { data: newAuthor, error: authorError } = await supabase
    .from('authors')
    .insert({
      name: authorData.name,
      author_type: 'staff',
      email: authorData.email || null,
      bio: authorData.description || null,
      is_active: true
    })
    .select('id')
    .single();

  if (authorError) {
    console.error('Error creating author:', authorError);
    return null;
  }

  console.log(`Created new author: ${authorData.name} (${newAuthor.id})`);

  // Create mapping
  const { error: mappingError } = await supabase
    .from('wordpress_author_mapping')
    .insert({
      wordpress_author_id: wpArticle.author,
      wordpress_author_name: authorData.name,
      system_author_id: newAuthor.id,
      mapping_confidence: 1.0,
      is_verified: true
    });

  if (mappingError) {
    console.error('Error creating author mapping:', mappingError);
  }

  return newAuthor.id;
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
    
    const { maxArticles = 100, startDate, endDate, legacyMode = true } = await req.json().catch(() => ({}))

    console.log(`Starting enhanced WordPress sync, legacy mode: ${legacyMode}`)
    console.log(`Date range: ${startDate || 'no start'} to ${endDate || 'no end'}`)
    console.log(`Max articles: ${maxArticles}`)

    const auth = btoa(`${username}:${password}`)
    let wpApiUrl = `${wordpressUrl}/wp-json/wp/v2/posts?per_page=100&_embed`
    
    if (startDate) wpApiUrl += `&after=${startDate}T00:00:00`
    if (endDate) wpApiUrl += `&before=${endDate}T23:59:59`
    
    // Fetch WordPress articles
    let allArticles = []
    let page = 1
    let totalFetched = 0
    
    while (totalFetched < maxArticles) {
      const remainingArticles = maxArticles - totalFetched
      const perPage = Math.min(remainingArticles, 100)
      
      let currentUrl = wpApiUrl.replace(/per_page=\d+/, `per_page=${perPage}`)
      if (page > 1) currentUrl += `&page=${page}`
      
      console.log(`Fetching page ${page}: ${currentUrl}`)
      
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
      
      console.log(`Fetched ${wpArticles.length} articles from page ${page}`)
      allArticles.push(...wpArticles)
      totalFetched += wpArticles.length
      
      if (wpArticles.length < perPage) break
      page++
    }

    const syncResults = {
      processed: 0,
      created: 0,
      updated: 0,
      matched: 0,
      skipped: 0,
      errors: [],
      matchDetails: []
    }

    console.log(`Processing ${allArticles.length} WordPress articles...`)

    for (const wpArticle of allArticles) {
      try {
        syncResults.processed++
        
        console.log(`\n--- Processing article ${syncResults.processed}/${allArticles.length} ---`);
        console.log(`WP ID: ${wpArticle.id}, Title: "${wpArticle.title.rendered}"`);
        console.log(`WP Date: ${wpArticle.date}, Modified: ${wpArticle.modified}`);
        console.log(`WP Status: ${wpArticle.status}, Author ID: ${wpArticle.author}`);

        // Handle author first
        const authorId = await handleAuthor(supabase, wpArticle)
        console.log(`Author assigned: ${authorId || 'none'}`);

        // Check for existing article with proper date range consideration
        const existingMatch = await findExistingArticle(supabase, wpArticle, startDate, endDate)

        // Parse dates properly
        const publishedDate = new Date(wpArticle.date).toISOString().split('T')[0];
        const modifiedDate = wpArticle.modified ? new Date(wpArticle.modified).toISOString().split('T')[0] : publishedDate;
        
        console.log(`Using published date: ${publishedDate}, modified date: ${modifiedDate}`);

        const articleData = {
          wordpress_id: wpArticle.id,
          title: wpArticle.title.rendered,
          content_variants: {
            wordpress_content: {
              content: wpArticle.content.rendered,
              excerpt: wpArticle.excerpt.rendered,
              featured_media: wpArticle.featured_media,
              categories: wpArticle.categories,
              tags: wpArticle.tags
            }
          },
          primary_author_id: authorId,
          wordpress_author_id: wpArticle.author,
          wordpress_author_name: wpArticle._embedded?.author?.[0]?.name || 'Unknown',
          wordpress_categories: wpArticle.categories || [],
          wordpress_tags: wpArticle.tags || [],
          published_at: publishedDate,
          article_date: publishedDate,
          last_wordpress_sync: new Date().toISOString(),
          status: wpArticle.status === 'publish' ? 'published' : 'draft',
          source_system: 'wordpress',
          source_url: wpArticle.link || null,
          excerpt: wpArticle.excerpt.rendered?.replace(/<[^>]*>/g, '').substring(0, 500) || null,
          updated_at: modifiedDate
        }

        console.log(`Article data prepared:`, {
          wordpress_id: articleData.wordpress_id,
          published_at: articleData.published_at,
          primary_author_id: articleData.primary_author_id,
          status: articleData.status
        });

        if (existingMatch) {
          // Update existing article
          console.log(`Updating existing article: ${existingMatch.match.id}`);
          const { error } = await supabase
            .from('articles')
            .update(articleData)
            .eq('id', existingMatch.match.id)
          
          if (error) {
            console.error('Update error:', error);
            throw error;
          }
          
          syncResults.updated++
          syncResults.matched++
          syncResults.matchDetails.push({
            wordpress_id: wpArticle.id,
            article_id: existingMatch.match.id,
            match_type: existingMatch.matchType,
            confidence: existingMatch.confidence,
            title: wpArticle.title.rendered
          })
          
          console.log(`✓ Updated article: ${wpArticle.title.rendered} (${existingMatch.matchType}, confidence: ${existingMatch.confidence.toFixed(2)})`)
        } else {
          // Create new article
          console.log(`Creating new article...`);
          const { error } = await supabase
            .from('articles')
            .insert(articleData)
          
          if (error) {
            console.error('Insert error:', error);
            throw error;
          }
          
          syncResults.created++
          console.log(`✓ Created new article: ${wpArticle.title.rendered}`)
        }

      } catch (error) {
        console.error(`Error processing article ${wpArticle.id}:`, error)
        syncResults.errors.push(`Article ${wpArticle.id} (${wpArticle.title?.rendered || 'Unknown'}): ${error.message}`)
      }
    }

    console.log(`\n=== Enhanced sync completed ===`);
    console.log(`Processed: ${syncResults.processed}`);
    console.log(`Created: ${syncResults.created}`);
    console.log(`Updated: ${syncResults.updated}`);
    console.log(`Matched: ${syncResults.matched}`);
    console.log(`Errors: ${syncResults.errors.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: syncResults,
        totalArticles: allArticles.length
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
