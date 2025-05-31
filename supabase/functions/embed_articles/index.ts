// supabase/functions/embed_articles/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?dts';
Deno.serve(async ()=>{
  console.log('--- embed_articles function STARTED ---');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const EMBEDDING_MODEL = 'text-embedding-3-small';
  console.log('ENV CHECK', {
    SUPABASE_URL_PRESENT: !!SUPABASE_URL,
    SERVICE_ROLE_PRESENT: !!SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_KEY_PRESENT: !!OPENAI_API_KEY
  });
  console.log('SERVICE KEY LENGTH:', SUPABASE_SERVICE_ROLE_KEY?.length || 'undefined');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    console.error('❌ Missing one or more required environment variables');
    return new Response(JSON.stringify({
      error: 'Missing environment variables'
    }), {
      status: 500
    });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: articles, error } = await supabase.from('articles').select('id, content_variants').is('embedding', null).limit(5);
  if (error) {
    console.error('❌ Supabase query error:', error.message);
    return new Response(JSON.stringify({
      error: 'Error fetching articles from Supabase'
    }), {
      status: 500
    });
  } else if (!articles) {
    console.error('⚠️ No articles returned (null response)');
    return new Response(JSON.stringify({
      message: 'No articles returned'
    }), {
      status: 200
    });
  } else if (articles.length === 0) {
    console.warn('⚠️ Query succeeded but no articles matched filter.');
    return new Response(JSON.stringify({
      message: 'No articles found with null embeddings'
    }), {
      status: 200
    });
  } else {
    console.log(`📦 Retrieved ${articles.length} article(s) for embedding.`);
  }
  const embeddedIds = [];
  for (const article of articles){
    let content = '';
    try {
      const parsed = typeof article.content_variants === 'string' ? JSON.parse(article.content_variants) : article.content_variants;
      content = parsed?.long || '';
      console.log(`📝 Embedding article: ${article.id}`);
      console.log('📖 Excerpt:', content.slice(0, 100));
    } catch (err) {
      console.error(`⚠️ Failed to parse content_variants for article ${article.id}:`, err.message);
      continue;
    }
    if (!content || content.trim().length < 10) {
      console.warn(`⏭️ Skipping short or empty content for article ${article.id}`);
      continue;
    }
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: content.slice(0, 8000)
        })
      });
      const result = await response.json();
      const embedding = result.data?.[0]?.embedding;
      if (!embedding) {
        console.error(`❌ No embedding returned for article ${article.id}:`, result);
        continue;
      }
      const { error: updateError } = await supabase.from('articles').update({
        embedding
      }).eq('id', article.id);
      if (updateError) {
        console.error(`❌ Failed to update article ${article.id}:`, updateError.message);
      } else {
        console.log(`✅ Successfully embedded and updated article: ${article.id}`);
        embeddedIds.push(article.id);
      }
    } catch (err) {
      console.error(`🔥 Error embedding article ${article.id}:`, err.message);
    }
  }
  return new Response(JSON.stringify({
    embedded: embeddedIds.length,
    ids: embeddedIds
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
});
