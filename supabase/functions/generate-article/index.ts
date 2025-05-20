
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/supabase

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  newsItemId?: string;
  target: string;
  briefId?: string;
  theme?: string;
  outline?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { newsItemId, target, briefId, theme, outline } = await req.json() as RequestBody;
    
    if (!target) {
      return new Response(
        JSON.stringify({ error: "Target is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Connect to Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get OpenAI API key from Supabase secrets
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let newsItem = null;
    let briefData = null;
    
    // If newsItemId is provided, fetch the news item
    if (newsItemId) {
      const { data: fetchedNewsItem, error: fetchError } = await supabaseClient
        .from('news')
        .select('*')
        .eq('id', newsItemId)
        .single();

      if (fetchError) {
        console.error("Failed to fetch news item:", fetchError);
      } else {
        newsItem = fetchedNewsItem;
      }
    }

    // If briefId is provided, fetch the brief
    if (briefId) {
      const { data: fetchedBrief, error: briefError } = await supabaseClient
        .from('editor_briefs')
        .select('*')
        .eq('id', briefId)
        .single();

      if (briefError) {
        console.error("Failed to fetch brief:", briefError);
      } else {
        briefData = fetchedBrief;
      }
    }

    // Generate content with OpenAI based on the news item and/or brief
    let prompt = '';
    
    if (target === 'mpdaily') {
      prompt = `Create a concise email newsletter item based on the following news:
        
Headline: ${newsItem ? newsItem.headline : theme || "No headline provided"}

Summary: ${newsItem ? newsItem.summary : outline || "No summary provided"}

Source: ${newsItem ? newsItem.source : "Not specified"}

Format your response with:
1. An engaging headline (maximum 10 words)
2. A brief summary (3-4 sentences maximum)
3. A bulleted list of 2-3 key points
4. A short call-to-action`;
    } else if (target === 'magazine') {
      prompt = `Create a complete magazine article draft based on the following:
        
${briefData ? `THEME: ${briefData.theme}` : theme ? `THEME: ${theme}` : ""}

${briefData && briefData.summary ? `SUMMARY: ${briefData.summary}` : ""}

${briefData && briefData.outline ? `OUTLINE: ${briefData.outline}` : outline ? `OUTLINE: ${outline}` : ""}

${newsItem ? `REFERENCE NEWS: ${newsItem.headline}\n${newsItem.summary || ""}` : ""}

Format your response with:
1. A catchy headline
2. An engaging introduction (2-3 paragraphs)
3. 3-4 fully developed sections with subheadings
4. Expert quotes or data points (you can fabricate these for the draft)
5. A conclusion with reader takeaways
6. Make the article around 800-1000 words in length.

Write this as a complete, well-structured article ready for minimal editing.`;
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
    const generatedContent = openaiData.choices[0].message.content;
    
    // If this is for the magazine and we have a briefId, update the brief status
    if (target === 'magazine' && briefId) {
      const { error: updateError } = await supabaseClient
        .from('editor_briefs')
        .update({
          status: 'content_generated',
        })
        .eq('id', briefId);
        
      if (updateError) {
        console.error('Error updating brief status:', updateError);
      }
    }

    // Return the generated content
    return new Response(
      JSON.stringify({
        success: true,
        generatedContent,
        sourceType: newsItem ? 'news' : briefData ? 'brief' : 'custom',
        sourceId: newsItem ? newsItem.id : briefData ? briefData.id : null
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

// Helper to create a Supabase client
function createClient(supabaseUrl: string, supabaseKey: string) {
  return {
    from: (table: string) => ({
      select: (columns: string = "*") => ({
        single: () => {
          return fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}`, {
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              apikey: supabaseKey,
            },
          }).then(async (res) => {
            if (!res.ok) {
              const error = await res.json();
              return { data: null, error };
            }
            const data = await res.json();
            return { data: data[0] || null, error: null };
          });
        },
        eq: (column: string, value: any) => ({
          single: async () => {
            const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}&select=${columns}`, {
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                apikey: supabaseKey,
              },
            });
            if (!res.ok) {
              const error = await res.json();
              return { data: null, error };
            }
            const data = await res.json();
            return { data: data[0] || null, error: null };
          },
        }),
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          single: async () => {
            const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                apikey: supabaseKey,
                Prefer: "return=representation",
              },
              body: JSON.stringify(data),
            });
            if (!res.ok) {
              const error = await res.json();
              return { data: null, error };
            }
            const resData = await res.json();
            return { data: resData[0] || null, error: null };
          }
        }),
      }),
    }),
  };
}
