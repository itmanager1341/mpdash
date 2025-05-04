
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  matched_clusters: string[];
  is_competitor_covered: boolean;
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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get OpenAI API key from Supabase secrets
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { newsItemId, target } = await req.json();
    
    if (!newsItemId) {
      return new Response(
        JSON.stringify({ error: 'News item ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the news item from the database
    const { data: newsItem, error: fetchError } = await supabase
      .from('news')
      .select('*')
      .eq('id', newsItemId)
      .single();

    if (fetchError || !newsItem) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch news item', details: fetchError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate content with OpenAI based on the news item
    let prompt = '';
    let generatedContent = '';
    
    if (target === 'mpdaily') {
      prompt = `Create a concise email newsletter item based on the following news:
        
Headline: ${newsItem.headline}

Summary: ${newsItem.summary}

Source: ${newsItem.source}

Format your response with:
1. An engaging headline (maximum 10 words)
2. A brief summary (3-4 sentences maximum)
3. A bulleted list of 2-3 key points
4. A short call-to-action`;
    } else if (target === 'magazine') {
      prompt = `Create an outline for a magazine article based on the following news:
        
Headline: ${newsItem.headline}

Summary: ${newsItem.summary}

Source: ${newsItem.source}

Format your response with:
1. A catchy headline
2. An executive summary (2 paragraphs)
3. 4-5 section headers with brief descriptions
4. Potential expert sources to interview
5. Data points that would strengthen the article`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid target specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
            content: 'You are an expert financial editor specializing in mortgage industry content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to generate content with OpenAI', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    generatedContent = openaiData.choices[0].message.content;

    // Determine which table to insert into based on target
    let insertData;
    let result;
    
    if (target === 'mpdaily') {
      insertData = {
        title: newsItem.headline,
        content: generatedContent,
        status: 'drafted',
        fred_data: null,
        related_trends: newsItem.matched_clusters
      };
      
      const { data, error } = await supabase
        .from('articles')
        .insert(insertData)
        .select()
        .single();
        
      if (error) throw error;
      result = data;
    } else if (target === 'magazine') {
      insertData = {
        theme: newsItem.headline,
        outline: generatedContent,
        summary: newsItem.summary,
        suggested_articles: [newsItem.id],
        status: 'draft'
      };
      
      const { data, error } = await supabase
        .from('editor_briefs')
        .insert(insertData)
        .select()
        .single();
        
      if (error) throw error;
      result = data;
    }

    // Return the generated content and new record
    return new Response(
      JSON.stringify({
        success: true,
        generatedContent,
        result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-article function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
