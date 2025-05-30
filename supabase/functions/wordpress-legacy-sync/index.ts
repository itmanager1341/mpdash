
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

// Enhanced duplicate checking with legacy article matching
async function findExistingArticle(supabase: any, wpArticle: any) {
  // First check by WordPress ID (for already synced articles)
  if (wpArticle.id) {
    const { data: existingByWpId } = await supabase
      .from('articles')
      .select('id, title, wordpress_id')
      .eq('wordpress_id', wpArticle.id)
      .maybeSingle();
    
    if (existingByWpId) {
      return { 
        match: existingByWpId, 
        matchType: 'wordpress_id', 
        confidence: 1.0,
        action: 'update'
      };
    }
  }

  const wpTitle = wpArticle.title.rendered?.trim();
  const wpDate = new Date(wpArticle.date).toISOString().split('T')[0];
  
  if (!wpTitle || wpTitle.length < 10) return null;

  // Look for potential matches by title similarity and date proximity
  const dateRange = 7; // days
  const startDate = new Date(wpDate);
  startDate.setDate(startDate.getDate() - dateRange);
  const endDate = new Date(wpDate);
  endDate.setDate(endDate.getDate() + dateRange);

  const { data: candidates } = await supabase
    .from('articles')
    .select('id, title, published_at, article_date, wordpress_id')
    .is('wordpress_id', null)
    .gte('published_at', startDate.toISOString().split('T')[0])
    .lte('published_at', endDate.toISOString().split('T')[0])
    .limit(20);

  if (!candidates || candidates.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0.7; // Minimum threshold for matching

  for (const candidate of candidates) {
    const similarity = calculateTitleSimilarity(wpTitle, candidate.title);
    
    // Date proximity bonus
    const candidateDate = new Date(candidate.published_at || candidate.article_date);
    const daysDiff = Math.abs((new Date(wpDate).getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24));
    const dateBonus = Math.max(0, (dateRange - daysDiff) / dateRange * 0.1);
    
    const totalScore = similarity + dateBonus;
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = candidate;
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

  return null;
}

// Create or find author
async function handleAuthor(supabase: any, wpArticle: any) {
  const authorData = wpArticle._embedded?.author?.[0];
  if (!authorData) return null;

  // Check existing WordPress author mapping
  const { data: existingMapping } = await supabase
    .from('wordpress_author_mapping')
    .select('system_author_id, authors(*)')
    .eq('wordpress_author_id', wpArticle.author)
    .maybeSingle();

  if (existingMapping?.system_author_id) {
    return existingMapping.system_author_id;
  }

  // Try to find existing author by name
  const { data: existingAuthor } = await supabase
    .from('authors')
    .select('id')
    .ilike('name', authorData.name)
    .maybeSingle();

  if (existingAuthor) {
    // Create mapping
    await supabase
      .from('wordpress_author_mapping')
      .upsert({
        wordpress_author_id: wpArticle.author,
        wordpress_author_name: authorData.name,
        system_author_id: existingAuthor.id,
        mapping_confidence: 1.0,
        is_verified: true
      });
    return existingAuthor.id;
  }

  // Create new author
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

  // Create mapping
  await supabase
    .from('wordpress_author_mapping')
    .insert({
      wordpress_author_id: wpArticle.author,
      wordpress_author_name: authorData.name,
      system_author_id: newAuthor.id,
      mapping_confidence: 1.0,
      is_verified: true
    });

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
      
      console.log(`Fetching page ${page}...`)
      
      const wpResponse = await fetch(currentUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      })

      if (!wpResponse.ok) {
        if (wpResponse.status === 400 && page > 1) break
        throw new Error(`WordPress API error: ${wpResponse.status}`)
      }

      const wpArticles = await wpResponse.json()
      if (!wpArticles || wpArticles.length === 0) break
      
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

    console.log(`Processing ${allArticles.length} articles...`)

    for (const wpArticle of allArticles) {
      try {
        syncResults.processed++

        // Handle author
        const authorId = await handleAuthor(supabase, wpArticle)

        // Check for existing article
        const existingMatch = await findExistingArticle(supabase, wpArticle)

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
          published_at: new Date(wpArticle.date).toISOString().split('T')[0],
          article_date: new Date(wpArticle.date).toISOString().split('T')[0],
          last_wordpress_sync: new Date().toISOString(),
          status: wpArticle.status === 'publish' ? 'published' : 'draft',
          source_system: 'wordpress',
          source_url: wpArticle.link || null,
          excerpt: wpArticle.excerpt.rendered?.replace(/<[^>]*>/g, '').substring(0, 500) || null
        }

        if (existingMatch) {
          // Update existing article
          const { error } = await supabase
            .from('articles')
            .update(articleData)
            .eq('id', existingMatch.match.id)
          
          if (error) throw error
          
          syncResults.updated++
          syncResults.matched++
          syncResults.matchDetails.push({
            wordpress_id: wpArticle.id,
            article_id: existingMatch.match.id,
            match_type: existingMatch.matchType,
            confidence: existingMatch.confidence,
            title: wpArticle.title.rendered
          })
          
          console.log(`Updated article: ${wpArticle.title.rendered} (${existingMatch.matchType}, confidence: ${existingMatch.confidence.toFixed(2)})`)
        } else {
          // Create new article
          const { error } = await supabase
            .from('articles')
            .insert(articleData)
          
          if (error) throw error
          syncResults.created++
          console.log(`Created new article: ${wpArticle.title.rendered}`)
        }

      } catch (error) {
        console.error(`Error processing article ${wpArticle.id}:`, error)
        syncResults.errors.push(`Article ${wpArticle.id}: ${error.message}`)
      }
    }

    console.log(`Enhanced sync completed: ${syncResults.created} created, ${syncResults.updated} updated, ${syncResults.matched} matched`)

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
