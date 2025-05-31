
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?dts';

// Generate embedding for search query
async function generateQueryEmbedding(query: string, openaiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      return null;
    }

    const result = await response.json();
    return result.data?.[0]?.embedding || null;
  } catch (error) {
    console.error('Error generating query embedding:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  console.log('--- hybrid-content-search function STARTED ---');
  
  // Environment variables
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    console.error('❌ Missing required environment variables');
    return new Response(JSON.stringify({
      error: 'Missing environment variables'
    }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Parse request body
    const {
      query,
      search_type = 'hybrid', // 'vector', 'text', 'hybrid'
      similarity_threshold = 0.7,
      max_results = 20,
      filters = {}
    } = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'Query is required'
      }), { status: 400 });
    }

    console.log(`🔍 Performing ${search_type} search for: "${query}"`);

    let queryEmbedding = null;
    
    // Generate embedding for vector or hybrid search
    if (search_type === 'vector' || search_type === 'hybrid') {
      queryEmbedding = await generateQueryEmbedding(query, OPENAI_API_KEY);
      if (!queryEmbedding) {
        console.warn('⚠️ Failed to generate query embedding, falling back to text search');
        // Fall back to text search if embedding fails
        search_type = 'text';
      }
    }

    // Prepare article filters
    const articleFilters = JSON.stringify(filters);

    // Call the database search function
    const { data: searchResults, error } = await supabase.rpc('search_content_chunks', {
      query_text: query,
      query_embedding: queryEmbedding,
      similarity_threshold: similarity_threshold,
      max_results: max_results,
      article_filters: JSON.parse(articleFilters)
    });

    if (error) {
      console.error('❌ Search error:', error);
      return new Response(JSON.stringify({
        error: 'Search failed',
        details: error.message
      }), { status: 500 });
    }

    // Group results by article for better presentation
    const groupedResults = {};
    searchResults?.forEach(result => {
      if (!groupedResults[result.article_id]) {
        groupedResults[result.article_id] = {
          article_id: result.article_id,
          article_title: result.article_title,
          article_status: result.article_status,
          chunks: [],
          max_rank: 0
        };
      }
      
      groupedResults[result.article_id].chunks.push({
        id: result.id,
        content: result.content,
        word_count: result.word_count,
        chunk_type: result.chunk_type,
        similarity: result.similarity,
        rank: result.rank
      });
      
      // Track highest ranking chunk for sorting articles
      if (result.rank > groupedResults[result.article_id].max_rank) {
        groupedResults[result.article_id].max_rank = result.rank;
      }
    });

    // Sort articles by their highest ranking chunk
    const sortedArticles = Object.values(groupedResults)
      .sort((a, b) => b.max_rank - a.max_rank);

    console.log(`✅ Found ${searchResults?.length || 0} chunks across ${sortedArticles.length} articles`);

    return new Response(JSON.stringify({
      query: query,
      search_type: search_type,
      total_chunks: searchResults?.length || 0,
      total_articles: sortedArticles.length,
      results: sortedArticles,
      raw_chunks: searchResults // Include raw results for debugging
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🔥 Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), { status: 500 });
  }
});
