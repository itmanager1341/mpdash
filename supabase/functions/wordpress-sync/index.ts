
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Function to check if an article already exists by WordPress ID or title similarity
async function checkForDuplicate(supabase: any, wpArticle: any) {
  console.log(`Checking for duplicates of WP article ${wpArticle.id}: "${wpArticle.title.rendered}"`);
  
  // First, check by WordPress ID (most reliable)
  if (wpArticle.id) {
    const { data: existingByWpId } = await supabase
      .from('articles')
      .select('id')
      .eq('wordpress_id', wpArticle.id)
      .maybeSingle();
    
    if (existingByWpId) {
      console.log(`Found existing article with WP ID ${wpArticle.id}`);
      return { isDuplicate: true, existingId: existingByWpId.id, matchType: 'wordpress_id' };
    }
  }

  // For legacy articles or when WordPress ID doesn't match, check by title similarity
  const title = wpArticle.title.rendered?.trim();
  if (title && title.length > 5) {
    // Get articles with similar titles (case-insensitive, partial match)
    const { data: similarTitles } = await supabase
      .from('articles')
      .select('id, title')
      .ilike('title', `%${title.substring(0, Math.min(20, title.length))}%`)
      .limit(5);

    if (similarTitles && similarTitles.length > 0) {
      // Check for close title matches
      for (const existing of similarTitles) {
        const normalizedExisting = existing.title.toLowerCase().trim();
        const normalizedNew = title.toLowerCase().trim();
        
        // Consider it a duplicate if titles are very similar (exact match only)
        if (normalizedExisting === normalizedNew) {
          console.log(`Found exact title match: "${existing.title}"`);
          return { isDuplicate: true, existingId: existing.id, matchType: 'exact_title' };
        }
      }
    }
  }

  console.log('No duplicate found - article is unique');
  return { isDuplicate: false, existingId: null, matchType: null };
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
      throw new Error('WordPress credentials not configured. Please set WORDPRESS_URL, WORDPRESS_USERNAME, and WORDPRESS_PASSWORD in Supabase secrets.')
    }
    
    // Get parameters from request body
    const { maxArticles = 100, startDate, endDate } = await req.json().catch(() => ({}))

    console.log(`Starting WordPress sync from ${wordpressUrl}, max ${maxArticles} articles`)
    if (startDate) console.log(`Start date filter: ${startDate}`)
    if (endDate) console.log(`End date filter: ${endDate}`)

    // WordPress REST API authentication
    const auth = btoa(`${username}:${password}`)
    
    // Build WordPress API URL with date filters and per_page limit
    let wpApiUrl = `${wordpressUrl}/wp-json/wp/v2/posts?per_page=${Math.min(maxArticles, 100)}&_embed`
    
    if (startDate) {
      wpApiUrl += `&after=${startDate}T00:00:00`
    }
    
    if (endDate) {
      wpApiUrl += `&before=${endDate}T23:59:59`
    }
    
    // If we need more than 100 articles, we'll need to paginate
    let allArticles = []
    let page = 1
    let totalFetched = 0
    
    while (totalFetched < maxArticles) {
      const remainingArticles = maxArticles - totalFetched
      const perPage = Math.min(remainingArticles, 100)
      
      let currentUrl = wpApiUrl.replace(/per_page=\d+/, `per_page=${perPage}`)
      if (page > 1) {
        currentUrl += `&page=${page}`
      }
      
      console.log(`Fetching page ${page}, ${perPage} articles...`)
      
      const wpResponse = await fetch(currentUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      })

      if (!wpResponse.ok) {
        if (wpResponse.status === 400 && page > 1) {
          // No more pages available
          console.log('No more pages available')
          break
        }
        throw new Error(`WordPress API error: ${wpResponse.status} - ${wpResponse.statusText}`)
      }

      const wpArticles = await wpResponse.json()
      
      if (!wpArticles || wpArticles.length === 0) {
        console.log('No more articles found')
        break
      }
      
      allArticles.push(...wpArticles)
      totalFetched += wpArticles.length
      
      // If we got fewer articles than requested, we've reached the end
      if (wpArticles.length < perPage) {
        console.log('Reached end of available articles')
        break
      }
      
      page++
    }

    const syncResults = {
      synced: 0,
      updated: 0,
      duplicates: 0,
      errors: []
    }

    console.log(`Processing ${allArticles.length} articles...`)

    for (const wpArticle of allArticles) {
      try {
        console.log(`Processing WP article ${wpArticle.id}: "${wpArticle.title.rendered}"`);
        console.log(`WP Date: ${wpArticle.date}, Status: ${wpArticle.status}, Author: ${wpArticle.author}`);
        
        // Check for duplicates using improved logic
        const duplicateCheck = await checkForDuplicate(supabase, wpArticle)
        
        if (duplicateCheck.isDuplicate) {
          syncResults.duplicates++
          console.log(`Skipping duplicate article (${duplicateCheck.matchType}): ${wpArticle.title.rendered}`)
          continue
        }

        // Extract WordPress author info and handle author
        const authorData = wpArticle._embedded?.author?.[0]
        let authorId = null;
        
        if (authorData && wpArticle.author) {
          authorId = await handleAuthor(supabase, wpArticle.author, authorData);
        }
        
        const publishedDate = new Date(wpArticle.date).toISOString().split('T')[0];
        
        console.log(`Using published date: ${publishedDate}`);
        console.log(`Author assigned: ${authorId || 'none'}`);
        
        // Prepare article data
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
          wordpress_author_name: authorData?.name || 'Unknown',
          wordpress_categories: wpArticle.categories || [],
          wordpress_tags: wpArticle.tags || [],
          published_at: publishedDate,
          article_date: publishedDate,
          last_wordpress_sync: new Date().toISOString(),
          status: wpArticle.status === 'publish' ? 'published' : 'draft',
          source_system: 'wordpress',
          source_url: wpArticle.link || null,
          excerpt: wpArticle.excerpt.rendered?.replace(/<[^>]*>/g, '').substring(0, 500) || null
        }

        // Insert new article (we already checked for duplicates)
        const { error } = await supabase
          .from('articles')
          .insert(articleData)
        
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        
        syncResults.synced++
        console.log(`✓ Synced new article: ${wpArticle.title.rendered}`)

      } catch (error) {
        console.error(`Error syncing article ${wpArticle.id}:`, error)
        syncResults.errors.push(`Article ${wpArticle.id}: ${error.message}`)
      }
    }

    console.log(`Sync completed: ${syncResults.synced} new, ${syncResults.updated} updated, ${syncResults.duplicates} duplicates skipped, ${syncResults.errors.length} errors`)

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
    console.error('WordPress sync error:', error)
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
