
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
    const { newsId } = await req.json()

    // Get news item
    const { data: newsItem, error: newsError } = await supabase
      .from('news')
      .select('*')
      .eq('id', newsId)
      .single()

    if (newsError || !newsItem) {
      throw new Error('News item not found')
    }

    // Only match news that has been marked as published
    if (newsItem.publication_status !== 'published') {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'News item must be published before matching to articles'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get published articles for matching
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, content_variants, wordpress_categories, wordpress_tags, published_at')
      .eq('status', 'published')
      .not('wordpress_id', 'is', null)

    if (articlesError) {
      throw articlesError
    }

    let bestMatch = null
    let bestScore = 0

    // Simple matching algorithm based on title similarity and content keywords
    for (const article of articles || []) {
      let score = 0
      
      // Title similarity (basic keyword overlap)
      const newsKeywords = newsItem.headline.toLowerCase().split(' ').filter(w => w.length > 3)
      const articleKeywords = article.title.toLowerCase().split(' ').filter(w => w.length > 3)
      const titleOverlap = newsKeywords.filter(k => articleKeywords.includes(k)).length
      score += titleOverlap * 10

      // Content keyword matching if available
      const newsContent = (newsItem.summary || '').toLowerCase()
      const articleContent = (article.content_variants?.wordpress_content?.content || '').toLowerCase()
      
      if (newsContent && articleContent) {
        const newsContentWords = newsContent.split(' ').filter(w => w.length > 4)
        const contentMatches = newsContentWords.filter(w => articleContent.includes(w)).length
        score += contentMatches * 2
      }

      // Cluster matching if available
      if (newsItem.matched_clusters && article.content_variants?.ai_analysis?.matched_clusters) {
        const clusterOverlap = newsItem.matched_clusters.filter(c => 
          article.content_variants.ai_analysis.matched_clusters.includes(c)
        ).length
        score += clusterOverlap * 20
      }

      // Date proximity bonus (articles published around the same time)
      if (article.published_at && newsItem.timestamp) {
        const daysDiff = Math.abs(
          (new Date(article.published_at).getTime() - new Date(newsItem.timestamp).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysDiff <= 7) score += 5
        if (daysDiff <= 1) score += 10
      }

      if (score > bestScore && score > 15) { // Minimum threshold
        bestScore = score
        bestMatch = article
      }
    }

    if (bestMatch) {
      // Update news item with match
      const confidenceScore = Math.min(bestScore / 100, 1.0) // Normalize to 0-1
      
      const { error: updateError } = await supabase
        .from('news')
        .update({
          published_article_id: bestMatch.id,
          publication_confidence_score: confidenceScore
        })
        .eq('id', newsId)

      if (updateError) {
        throw updateError
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          match: {
            articleId: bestMatch.id,
            articleTitle: bestMatch.title,
            confidenceScore,
            matchScore: bestScore
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'No suitable article match found',
          threshold: 15
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('News matching error:', error)
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
