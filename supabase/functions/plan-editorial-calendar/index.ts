
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonthlyPlan {
  month: string; // YYYY-MM format
  theme: string;
  feature_articles: Array<{
    title: string;
    description: string;
    keywords: string[];
  }>;
  industry_analysis: Array<{
    title: string;
    description: string;
    keywords: string[];
  }>;
  market_trends: Array<{
    title: string;
    description: string;
    keywords: string[];
  }>;
  opinion_pieces: Array<{
    title: string;
    description: string;
    keywords: string[];
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Admin key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { 
      months = 6, 
      startMonth = new Date().toISOString().substring(0, 7), // YYYY-MM format
      focusThemes = [],
      considerKeywordClusters = true,
      avoidDuplication = true,
    } = await req.json();
    
    // Fetch keyword clusters for context
    let keywordClustersData = [];
    if (considerKeywordClusters) {
      const { data: clusters, error: clusterError } = await supabase
        .from('keyword_clusters')
        .select('primary_theme, sub_theme, keywords')
        .order('primary_theme', { ascending: true });
      
      if (clusterError) {
        console.error("Error fetching keyword clusters:", clusterError);
      } else if (clusters) {
        keywordClustersData = clusters;
      }
    }
    
    // Fetch recent articles to avoid duplication
    let recentArticlesData = [];
    if (avoidDuplication) {
      const { data: articles, error: articlesError } = await supabase
        .from('news')
        .select('headline, summary')
        .order('timestamp', { ascending: false })
        .limit(50);
      
      if (articlesError) {
        console.error("Error fetching recent articles:", articlesError);
      } else if (articles) {
        recentArticlesData = articles;
      }
    }
    
    // Prepare the prompt for OpenAI
    const keywordClustersContext = keywordClustersData.length > 0 ? 
      `Current Keyword Clusters:
${keywordClustersData.map(cluster => `- ${cluster.primary_theme}: ${cluster.sub_theme} (Keywords: ${(cluster.keywords || []).join(', ')})`).join('\n')}` 
      : '';
    
    const recentArticlesContext = recentArticlesData.length > 0 ?
      `Recent Articles (to avoid duplication):
${recentArticlesData.slice(0, 15).map(article => `- ${article.headline}`).join('\n')}`
      : '';
    
    const focusThemesContext = focusThemes.length > 0 ?
      `Focus Themes for Planning:
${focusThemes.join('\n')}`
      : '';

    const prompt = `
I need a comprehensive editorial calendar plan for a mortgage industry magazine spanning ${months} months, starting from ${startMonth}.

${focusThemesContext ? focusThemesContext + '\n\n' : ''}
${keywordClustersContext ? keywordClustersContext + '\n\n' : ''}
${recentArticlesContext ? recentArticlesContext + '\n\n' : ''}

For each month, provide:
1. An overall monthly theme
2. 3-4 feature article ideas
3. 2-3 industry analysis topics
4. 2-3 market trend insights
5. 1-2 opinion piece suggestions

Each article idea should include:
- A compelling title
- A brief description (1-2 sentences)
- 3-5 relevant keywords

The output should be structured as a JSON array of months, with each month containing the theme and article categories.

The calendar should incorporate seasonal trends in the mortgage industry, economic cycles, and regulatory changes where appropriate. Ensure a good balance between technical content, market analysis, and practical advice for mortgage professionals.
`;

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert editorial planner for a mortgage industry publication. Your specialty is creating strategic, forward-looking content plans that cover important themes and trends.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }
    
    const openaiData = await openaiResponse.json();
    let calendarPlan;
    
    try {
      // Parse the generated calendar plan as JSON
      const rawContent = openaiData.choices[0].message.content;
      calendarPlan = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("Error parsing OpenAI output as JSON:", parseError);
      console.log("Raw output:", openaiData.choices[0].message.content);
      
      throw new Error("Failed to parse AI-generated editorial calendar");
    }

    return new Response(
      JSON.stringify({
        success: true,
        calendar_plan: calendarPlan,
        metadata: {
          generated_at: new Date().toISOString(),
          months_planned: months,
          starting_month: startMonth,
          clusters_considered: keywordClustersData.length,
          articles_considered: recentArticlesData.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in plan-editorial-calendar function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
