
import { supabase } from "@/integrations/supabase/client";

export const ANALYSIS_PROMPT_FUNCTION_NAME = 'analyze-article-content';

export const DEFAULT_ANALYSIS_PROMPT = `Analyze this mortgage industry article for editorial performance prediction:

TITLE: {title}
CONTENT: {content}

KEYWORD CLUSTERS CONTEXT:
{clusters_context}

TEMPLATE TYPES REFERENCE:
1. News Analysis - Breaking news with expert commentary and market impact
2. Opinion/Editorial - Thought leadership pieces with clear stance and supporting arguments  
3. How-To/Guide - Step-by-step instructional content with actionable takeaways
4. Market Report - Data-driven analysis with charts, statistics, and trend interpretation
5. Interview/Profile - Q&A format or personality profiles with direct quotes
6. Regulatory Update - Policy changes, compliance requirements, and implementation guidance
7. Industry Trend - Forward-looking analysis of market movements and predictions

Provide analysis in this JSON format ONLY (no markdown, no extra text):
{
  "content_quality_score": 85,
  "template_classification": "news_analysis", 
  "template_compliance_score": 78,
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
  "template_insights": {
    "structure_score": 85,
    "required_elements_present": ["headline", "attribution", "expert_quotes"],
    "missing_elements": ["call_to_action"],
    "template_specific_suggestions": ["Add more data visualization", "Include expert quotes"]
  },
  "content_suggestions": [
    "Add more data visualization",
    "Include expert quotes"
  ]
}

Focus on mortgage industry relevance, professional audience engagement, template compliance, and content optimization opportunities. Return ONLY valid JSON.`;

export async function ensureAnalysisPromptExists() {
  try {
    // Check if the analysis prompt already exists
    const { data: existingPrompt, error: fetchError } = await supabase
      .from('llm_prompts')
      .select('id')
      .eq('function_name', ANALYSIS_PROMPT_FUNCTION_NAME)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw fetchError;
    }

    if (!existingPrompt) {
      // Create the analysis prompt
      const { error: insertError } = await supabase
        .from('llm_prompts')
        .insert({
          function_name: ANALYSIS_PROMPT_FUNCTION_NAME,
          prompt_text: DEFAULT_ANALYSIS_PROMPT,
          model: 'gpt-4o-mini',
          is_active: true,
          include_clusters: true,
          include_tracking_summary: false,
          include_sources_map: false,
          last_updated_by: 'System'
        });

      if (insertError) {
        throw insertError;
      }

      console.log('Created default analysis prompt');
    }

    return true;
  } catch (error) {
    console.error('Error ensuring analysis prompt exists:', error);
    return false;
  }
}

export async function getAnalysisPrompt() {
  try {
    const { data: prompt, error } = await supabase
      .from('llm_prompts')
      .select('prompt_text, model, include_clusters')
      .eq('function_name', ANALYSIS_PROMPT_FUNCTION_NAME)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching analysis prompt:', error);
      return {
        prompt_text: DEFAULT_ANALYSIS_PROMPT,
        model: 'gpt-4o-mini',
        include_clusters: true
      };
    }

    return prompt;
  } catch (error) {
    console.error('Error in getAnalysisPrompt:', error);
    return {
      prompt_text: DEFAULT_ANALYSIS_PROMPT,
      model: 'gpt-4o-mini',
      include_clusters: true
    };
  }
}
