
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    const { page = 1, perPage = 50, startDate, endDate } = await req.json().catch(() => ({}))

    console.log(`Starting WordPress sync from ${wordpressUrl}, page ${page}, ${perPage} per page`)
    if (startDate) console.log(`Start date filter: ${startDate}`)
    if (endDate) console.log(`End date filter: ${endDate}`)

    // WordPress REST API authentication
    const auth = btoa(`${username}:${password}`)
    
    // Build WordPress API URL with date filters
    let wpApiUrl = `${wordpressUrl}/wp-json/wp/v2/posts?page=${page}&per_page=${perPage}&_embed`
    
    if (startDate) {
      wpApiUrl += `&after=${startDate}T00:00:00`
    }
    
    if (endDate) {
      wpApiUrl += `&before=${endDate}T23:59:59`
    }
    
    // Fetch articles from WordPress
    const wpResponse = await fetch(wpApiUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    })

    if (!wpResponse.ok) {
      throw new Error(`WordPress API error: ${wpResponse.status} - ${wpResponse.statusText}`)
    }

    const wpArticles = await wpResponse.json()
    const syncResults = {
      synced: 0,
      updated: 0,
      errors: []
    }

    console.log(`Found ${wpArticles.length} articles to process`)

    for (const wpArticle of wpArticles) {
      try {
        // Extract WordPress author info
        const authorData = wpArticle._embedded?.author?.[0]
        
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
          wordpress_author_id: wpArticle.author,
          wordpress_author_name: authorData?.name || 'Unknown',
          wordpress_categories: wpArticle.categories || [],
          wordpress_tags: wpArticle.tags || [],
          published_at: new Date(wpArticle.date).toISOString().split('T')[0],
          last_wordpress_sync: new Date().toISOString(),
          status: wpArticle.status === 'publish' ? 'published' : 'draft',
          source_system: 'wordpress'
        }

        // Check if article exists
        const { data: existingArticle } = await supabase
          .from('articles')
          .select('id')
          .eq('wordpress_id', wpArticle.id)
          .single()

        if (existingArticle) {
          // Update existing article
          const { error } = await supabase
            .from('articles')
            .update(articleData)
            .eq('wordpress_id', wpArticle.id)
          
          if (error) throw error
          syncResults.updated++
          console.log(`Updated article: ${wpArticle.title.rendered}`)
        } else {
          // Insert new article
          const { error } = await supabase
            .from('articles')
            .insert(articleData)
          
          if (error) throw error
          syncResults.synced++
          console.log(`Synced new article: ${wpArticle.title.rendered}`)
        }

        // Handle author mapping
        if (authorData) {
          await supabase
            .from('wordpress_author_mapping')
            .upsert({
              wordpress_author_id: wpArticle.author,
              wordpress_author_name: authorData.name,
              mapping_confidence: 1.0
            }, { onConflict: 'wordpress_author_id' })
        }

      } catch (error) {
        console.error(`Error syncing article ${wpArticle.id}:`, error)
        syncResults.errors.push(`Article ${wpArticle.id}: ${error.message}`)
      }
    }

    console.log(`Sync completed: ${syncResults.synced} new, ${syncResults.updated} updated, ${syncResults.errors.length} errors`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: syncResults,
        totalArticles: wpArticles.length
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
