
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
    let calendarPlan = [];
    
    try {
      // Parse the generated calendar plan as JSON
      const rawContent = openaiData.choices[0].message.content;
      const parsedContent = JSON.parse(rawContent);
      
      // Extract the array of months from the response
      // Check various possible structures the AI might return
      if (parsedContent.editorial_calendar && Array.isArray(parsedContent.editorial_calendar)) {
        calendarPlan = parsedContent.editorial_calendar;
      } else if (parsedContent.months && Array.isArray(parsedContent.months)) {
        calendarPlan = parsedContent.months;
      } else if (Array.isArray(parsedContent)) {
        calendarPlan = parsedContent;
      } else {
        // Create a standardized format from whatever structure we got
        const months = [];
        Object.keys(parsedContent).forEach(key => {
          if (typeof parsedContent[key] === 'object' && parsedContent[key] !== null) {
            // Try to extract month data in a sensible way
            if (key.match(/^\d{4}-\d{2}$/) || key.includes('month')) {
              // It looks like a month key
              const monthData = parsedContent[key];
              const monthEntry = {
                month: key.match(/^\d{4}-\d{2}$/) ? key : startMonth, // Use the key if it's a date, otherwise use startMonth
                theme: monthData.theme || 'Mortgage Industry Trends',
                // Convert content categories to a standardized format
                topics: []
              };
              
              // Process feature articles
              if (monthData.feature_articles && Array.isArray(monthData.feature_articles)) {
                monthData.feature_articles.forEach(article => {
                  monthEntry.topics.push({
                    title: article.title,
                    type: 'Feature Article',
                    keywords: article.keywords || []
                  });
                });
              }
              
              // Process industry analysis
              if (monthData.industry_analysis && Array.isArray(monthData.industry_analysis)) {
                monthData.industry_analysis.forEach(analysis => {
                  monthEntry.topics.push({
                    title: analysis.title,
                    type: 'Industry Analysis',
                    keywords: analysis.keywords || []
                  });
                });
              }
              
              // Process market trends
              if (monthData.market_trends || monthData.market_trend_insights) {
                const trends = monthData.market_trends || monthData.market_trend_insights || [];
                if (Array.isArray(trends)) {
                  trends.forEach(trend => {
                    monthEntry.topics.push({
                      title: trend.title,
                      type: 'Market Trends',
                      keywords: trend.keywords || []
                    });
                  });
                }
              }
              
              // Process opinion pieces
              if (monthData.opinion_pieces && Array.isArray(monthData.opinion_pieces)) {
                monthData.opinion_pieces.forEach(opinion => {
                  monthEntry.topics.push({
                    title: opinion.title,
                    type: 'Opinion Piece',
                    keywords: opinion.keywords || []
                  });
                });
              }
              
              months.push(monthEntry);
            }
          }
        });
        
        if (months.length > 0) {
          calendarPlan = months;
        } else {
          throw new Error("Could not find month data in the response");
        }
      }
      
      // Process calendarPlan to ensure it has the correct structure
      calendarPlan = calendarPlan.map((month, index) => {
        // If it's not the expected format, try to normalize it
        if (!month.topics) {
          const topics = [];
          
          // Add all article types to topics array
          if (month.feature_articles) {
            month.feature_articles.forEach(article => {
              topics.push({
                title: article.title,
                type: 'Feature Article',
                keywords: article.keywords || []
              });
            });
          }
          
          if (month.industry_analysis) {
            month.industry_analysis.forEach(analysis => {
              topics.push({
                title: analysis.title,
                type: 'Industry Analysis',
                keywords: analysis.keywords || []
              });
            });
          }
          
          if (month.market_trends || month.market_trend_insights) {
            const trends = month.market_trends || month.market_trend_insights || [];
            trends.forEach(trend => {
              topics.push({
                title: trend.title,
                type: 'Market Trends',
                keywords: trend.keywords || []
              });
            });
          }
          
          if (month.opinion_pieces) {
            month.opinion_pieces.forEach(opinion => {
              topics.push({
                title: opinion.title,
                type: 'Opinion Piece',
                keywords: opinion.keywords || []
              });
            });
          }
          
          return {
            month: month.month || `${startMonth.substring(0, 5)}${String(parseInt(startMonth.substring(5, 7)) + index).padStart(2, '0')}`,
            theme: month.theme || 'Mortgage Industry Insights',
            topics
          };
        }
        
        return month;
      });
      
    } catch (parseError) {
      console.error("Error parsing OpenAI output:", parseError);
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
