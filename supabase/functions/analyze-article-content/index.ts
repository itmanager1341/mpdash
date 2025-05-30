
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { articleId, forceReanalysis = false } = await req.json()

    // Get article content
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      throw new Error('Article not found')
    }

    // Check if analysis already exists
    if (!forceReanalysis) {
      const { data: existingAnalysis } = await supabase
        .from('article_ai_analysis')
        .select('id')
        .eq('article_id', articleId)
        .order('analysis_version', { ascending: false })
        .limit(1)
        .single()

      if (existingAnalysis) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Analysis already exists',
            analysisId: existingAnalysis.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get content for analysis
    const content = article.content_variants?.wordpress_content?.content || 
                   article.content_variants?.editorial_content?.full_content ||
                   article.title

    if (!content) {
      throw new Error('No content found for analysis')
    }

    // Get keyword clusters for context
    const { data: clusters } = await supabase
      .from('keyword_clusters')
      .select('*')

    const clustersContext = clusters ? 
      clusters.map(c => `${c.primary_theme}: ${c.sub_theme} (${c.keywords?.join(', ') || ''})`).join('\n') : 
      ''

    // OpenAI analysis prompt
    const analysisPrompt = `
Analyze this mortgage industry article for editorial performance prediction:

TITLE: ${article.title}
CONTENT: ${content.substring(0, 4000)}...

KEYWORD CLUSTERS CONTEXT:
${clustersContext}

Provide analysis in this JSON format:
{
  "content_quality_score": 85,
  "template_classification": "news_analysis",
  "extracted_keywords": ["mortgage rates", "housing market"],
  "matched_clusters": ["Housing Market Trends", "Interest Rates"],
  "performance_prediction": {
    "engagement_score": 78,
    "shareability": 65,
    "seo_potential": 82,
    "target_audience": "mortgage professionals"
  },
  "readability_analysis": {
    "reading_level": "professional",
    "sentence_complexity": "medium",
    "jargon_level": "high"
  },
  "content_suggestions": [
    "Add more data visualization",
    "Include expert quotes"
  ]
}

Focus on mortgage industry relevance, professional audience engagement, and content optimization opportunities.`

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert content analyst for mortgage industry publications. Always respond with valid JSON only.' },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.3
      })
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiResult = await openaiResponse.json()
    const analysisText = openaiResult.choices[0]?.message?.content

    console.log('Raw OpenAI response:', analysisText)

    let analysisData
    try {
      // Remove markdown code blocks if present
      const cleanedText = analysisText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      analysisData = JSON.parse(cleanedText)
      console.log('Parsed analysis data:', analysisData)
    } catch (e) {
      console.error('JSON parsing failed:', e)
      // Fallback if JSON parsing fails
      analysisData = {
        content_quality_score: 70,
        template_classification: 'unknown',
        extracted_keywords: [],
        matched_clusters: [],
        performance_prediction: {
          engagement_score: 60,
          shareability: 50,
          seo_potential: 65,
          target_audience: 'general'
        },
        readability_analysis: {
          reading_level: 'intermediate',
          sentence_complexity: 'medium',
          jargon_level: 'medium'
        },
        content_suggestions: ['Review content structure'],
        analysis_raw: analysisText
      }
    }

    // Get next version number
    const { data: lastAnalysis } = await supabase
      .from('article_ai_analysis')
      .select('analysis_version')
      .eq('article_id', articleId)
      .order('analysis_version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (lastAnalysis?.analysis_version || 0) + 1

    // Save analysis with properly structured data
    const { data: newAnalysis, error: insertError } = await supabase
      .from('article_ai_analysis')
      .insert({
        article_id: articleId,
        analysis_version: nextVersion,
        ai_model_used: 'gpt-4o-mini',
        content_quality_score: analysisData.content_quality_score,
        template_classification: analysisData.template_classification,
        extracted_keywords: analysisData.extracted_keywords,
        matched_clusters: analysisData.matched_clusters,
        performance_prediction: analysisData.performance_prediction,
        analysis_data: analysisData
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      throw insertError
    }

    console.log('Analysis saved successfully:', newAnalysis)

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: newAnalysis,
        version: nextVersion
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Article analysis error:', error)
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
