
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

// Function to log LLM usage to database
async function logLlmUsage(supabase: any, params: {
  model: string;
  usage?: any;
  status: string;
  error?: string;
  startTime: number;
  metadata?: any;
}) {
  try {
    const duration = Date.now() - params.startTime;
    const promptTokens = params.usage?.prompt_tokens || 0;
    const completionTokens = params.usage?.completion_tokens || 0;
    const totalTokens = params.usage?.total_tokens || 0;
    
    // OpenAI pricing for gpt-4o-mini: $0.150 per 1M input tokens, $0.600 per 1M output tokens
    const inputCost = (promptTokens / 1000000) * 0.150;
    const outputCost = (completionTokens / 1000000) * 0.600;
    const estimatedCost = inputCost + outputCost;
    
    await supabase.rpc('log_llm_usage', {
      p_function_name: 'analyze-article-content',
      p_model: params.model,
      p_prompt_tokens: promptTokens,
      p_completion_tokens: completionTokens,
      p_total_tokens: totalTokens,
      p_estimated_cost: estimatedCost,
      p_duration_ms: duration,
      p_status: params.status,
      p_error_message: params.error || null,
      p_operation_metadata: params.metadata || {}
    });
  } catch (logError) {
    console.error('Failed to log LLM usage:', logError);
  }
}

// Robust JSON extraction function
function extractAndParseJSON(text: string): any {
  console.log('Attempting to parse JSON from text:', text)
  
  // Method 1: Try direct JSON.parse first
  try {
    const trimmed = text.trim()
    return JSON.parse(trimmed)
  } catch (e) {
    console.log('Direct JSON.parse failed:', e.message)
  }
  
  // Method 2: Remove common markdown code block patterns
  try {
    let cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    
    console.log('After markdown cleanup:', cleaned)
    return JSON.parse(cleaned)
  } catch (e) {
    console.log('Markdown cleanup parsing failed:', e.message)
  }
  
  // Method 3: Extract content between first { and last }
  try {
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = text.substring(firstBrace, lastBrace + 1)
      console.log('Extracted JSON between braces:', extracted)
      return JSON.parse(extracted)
    }
  } catch (e) {
    console.log('Brace extraction parsing failed:', e.message)
  }
  
  // Method 4: More aggressive cleaning - remove everything before first { and after last }
  try {
    let cleaned = text
    const lines = cleaned.split('\n')
    const jsonLines = []
    let inJson = false
    
    for (const line of lines) {
      if (line.trim().startsWith('{') || inJson) {
        inJson = true
        jsonLines.push(line)
      }
      if (line.trim().endsWith('}') && inJson) {
        break
      }
    }
    
    const jsonText = jsonLines.join('\n').trim()
    console.log('Line-by-line extracted JSON:', jsonText)
    return JSON.parse(jsonText)
  } catch (e) {
    console.log('Line-by-line extraction failed:', e.message)
  }
  
  throw new Error('Unable to extract valid JSON from response')
}

// Validate analysis data structure
function validateAnalysisData(data: any): boolean {
  const required = ['content_quality_score', 'template_classification']
  const hasRequired = required.every(field => data.hasOwnProperty(field))
  
  if (!hasRequired) {
    console.log('Missing required fields:', required.filter(field => !data.hasOwnProperty(field)))
    return false
  }
  
  // Validate score is reasonable (not placeholder)
  if (typeof data.content_quality_score !== 'number' || 
      data.content_quality_score < 1 || 
      data.content_quality_score > 100) {
    console.log('Invalid quality score:', data.content_quality_score)
    return false
  }
  
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { articleId, forceReanalysis = false } = await req.json()

    console.log('Starting analysis for article:', articleId)

    // Get article content
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      await logLlmUsage(supabase, {
        model: 'gpt-4o-mini',
        status: 'error',
        error: 'Article not found',
        startTime,
        metadata: { articleId, error_type: 'article_not_found' }
      });
      
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
      await logLlmUsage(supabase, {
        model: 'gpt-4o-mini',
        status: 'error',
        error: 'No content found for analysis',
        startTime,
        metadata: { articleId, error_type: 'no_content' }
      });
      
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

Provide analysis in this JSON format ONLY (no markdown, no extra text):
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

Focus on mortgage industry relevance, professional audience engagement, and content optimization opportunities. Return ONLY valid JSON.`

    console.log('Calling OpenAI with prompt for article:', article.title)

    // Call OpenAI with logging
    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert content analyst for mortgage industry publications. Always respond with valid JSON only, no markdown formatting.' },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.3
        })
      })

      if (!openaiResponse.ok) {
        await logLlmUsage(supabase, {
          model: 'gpt-4o-mini',
          status: 'error',
          error: `OpenAI API error: ${openaiResponse.status}`,
          startTime,
          metadata: {
            articleId,
            article_title: article.title,
            content_length: content.length,
            clusters_count: clusters?.length || 0
          }
        });
        
        throw new Error(`OpenAI API error: ${openaiResponse.status}`)
      }

      const openaiResult = await openaiResponse.json()
      const analysisText = openaiResult.choices[0]?.message?.content

      // Log successful API call
      await logLlmUsage(supabase, {
        model: openaiResult.model || 'gpt-4o-mini',
        usage: openaiResult.usage,
        status: 'success',
        startTime,
        metadata: {
          articleId,
          article_title: article.title,
          content_length: content.length,
          clusters_count: clusters?.length || 0,
          analysis_length: analysisText?.length || 0,
          force_reanalysis: forceReanalysis
        }
      });

      console.log('Raw OpenAI response length:', analysisText?.length)
      console.log('Raw OpenAI response:', analysisText)

      let analysisData
      try {
        analysisData = extractAndParseJSON(analysisText)
        console.log('Successfully parsed analysis data:', JSON.stringify(analysisData, null, 2))
        
        // Validate the parsed data
        if (!validateAnalysisData(analysisData)) {
          throw new Error('Parsed data failed validation')
        }
        
      } catch (e) {
        console.error('JSON parsing completely failed:', e)
        console.error('Original text that failed:', analysisText)
        
        // Only use fallback as last resort
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
          analysis_raw: analysisText,
          parsing_error: e.message
        }
        
        console.log('Using fallback data due to parsing failure')
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

      console.log('Saving analysis with score:', analysisData.content_quality_score)

      // Save analysis with properly structured data
      const { data: newAnalysis, error: insertError } = await supabase
        .from('article_ai_analysis')
        .insert({
          article_id: articleId,
          analysis_version: nextVersion,
          ai_model_used: 'gpt-4o-mini',
          content_quality_score: analysisData.content_quality_score,
          template_classification: analysisData.template_classification,
          extracted_keywords: analysisData.extracted_keywords || [],
          matched_clusters: analysisData.matched_clusters || [],
          performance_prediction: analysisData.performance_prediction || {},
          analysis_data: analysisData
        })
        .select()
        .single()

      if (insertError) {
        console.error('Database insert error:', insertError)
        throw insertError
      }

      console.log('Analysis saved successfully with ID:', newAnalysis.id)
      console.log('Final saved quality score:', newAnalysis.content_quality_score)

      return new Response(
        JSON.stringify({ 
          success: true, 
          analysis: newAnalysis,
          version: nextVersion,
          qualityScore: newAnalysis.content_quality_score
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )

    } catch (apiError) {
      console.error('OpenAI API call failed:', apiError);
      
      await logLlmUsage(supabase, {
        model: 'gpt-4o-mini',
        status: 'error',
        error: apiError instanceof Error ? apiError.message : String(apiError),
        startTime,
        metadata: {
          articleId,
          article_title: article.title,
          content_length: content.length,
          error_type: 'openai_api_failed'
        }
      });
      
      throw apiError;
    }

  } catch (error) {
    console.error('Article analysis error:', error)
    
    // Log general function error
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      await logLlmUsage(supabase, {
        model: 'gpt-4o-mini',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        startTime,
        metadata: {
          error_type: 'general_function_error'
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
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
