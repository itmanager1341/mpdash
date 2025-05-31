
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?dts';

// Configuration constants
const CHUNK_SIZE = 500; // Target words per chunk
const CHUNK_OVERLAP = 50; // Words to overlap between chunks
const MIN_CHUNK_SIZE = 100; // Minimum words for a valid chunk
const EMBEDDING_MODEL = 'text-embedding-3-small';

interface ChunkResult {
  content: string;
  word_count: number;
  chunk_type: 'title' | 'content' | 'summary';
}

// Intelligent chunking function that respects sentence boundaries
function intelligentChunk(text: string, chunkType: 'title' | 'content' | 'summary'): ChunkResult[] {
  if (!text || text.trim().length === 0) return [];
  
  // For titles, treat as single chunk
  if (chunkType === 'title') {
    const wordCount = text.trim().split(/\s+/).length;
    return [{
      content: text.trim(),
      word_count: wordCount,
      chunk_type: 'title'
    }];
  }
  
  // For summaries, also treat as single chunk if under threshold
  if (chunkType === 'summary') {
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount <= CHUNK_SIZE) {
      return [{
        content: text.trim(),
        word_count: wordCount,
        chunk_type: 'summary'
      }];
    }
  }
  
  // Split into sentences for intelligent chunking
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const chunks: ChunkResult[] = [];
  let currentChunk = '';
  let currentWordCount = 0;
  
  for (const sentence of sentences) {
    const sentenceWordCount = sentence.trim().split(/\s+/).length;
    
    // If adding this sentence would exceed chunk size, finalize current chunk
    if (currentWordCount > 0 && currentWordCount + sentenceWordCount > CHUNK_SIZE) {
      if (currentWordCount >= MIN_CHUNK_SIZE) {
        chunks.push({
          content: currentChunk.trim(),
          word_count: currentWordCount,
          chunk_type: chunkType
        });
      }
      
      // Start new chunk with overlap from previous chunk
      const words = currentChunk.trim().split(/\s+/);
      const overlapWords = words.slice(-CHUNK_OVERLAP);
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
      currentWordCount = overlapWords.length + sentenceWordCount;
    } else {
      // Add sentence to current chunk
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
      currentWordCount += sentenceWordCount;
    }
  }
  
  // Add final chunk if it meets minimum size
  if (currentWordCount >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: currentChunk.trim(),
      word_count: currentWordCount,
      chunk_type: chunkType
    });
  }
  
  return chunks;
}

// Generate embedding for text
async function generateEmbedding(text: string, openaiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000), // OpenAI limit
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      return null;
    }

    const result = await response.json();
    return result.data?.[0]?.embedding || null;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  console.log('--- process-article-chunks function STARTED ---');
  
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
    const { articleIds, limit = 5 } = await req.json();
    
    let query = supabase
      .from('articles')
      .select('id, title, content_variants, word_count, is_chunked')
      .eq('is_chunked', false)
      .is('content_variants', 'not.null')
      .gt('word_count', 0); // Only process articles that already have word count
    
    if (articleIds && Array.isArray(articleIds)) {
      query = query.in('id', articleIds);
    } else {
      query = query.limit(limit);
    }

    const { data: articles, error } = await query;

    if (error) {
      console.error('❌ Error fetching articles:', error);
      return new Response(JSON.stringify({ error: 'Error fetching articles' }), { status: 500 });
    }

    if (!articles || articles.length === 0) {
      console.log('⚠️ No articles found for chunking');
      return new Response(JSON.stringify({
        message: 'No articles found for chunking. Articles need word count > 0.',
        processed: 0
      }), { status: 200 });
    }

    console.log(`📦 Processing ${articles.length} article(s) for chunking`);

    const results = [];
    
    for (const article of articles) {
      console.log(`📝 Processing article: ${article.id} (word count: ${article.word_count})`);
      
      try {
        // Parse content variants
        const contentVariants = typeof article.content_variants === 'string' 
          ? JSON.parse(article.content_variants) 
          : article.content_variants;

        const longContent = contentVariants?.long || '';
        const summary = contentVariants?.summary || '';
        
        if (!longContent || longContent.trim().length < 50) {
          console.warn(`⏭️ Skipping article ${article.id} - insufficient content`);
          continue;
        }

        // Generate chunks for different content types
        const allChunks: ChunkResult[] = [];
        
        // Title chunk
        if (article.title) {
          allChunks.push(...intelligentChunk(article.title, 'title'));
        }
        
        // Summary chunk (if exists and different from content)
        if (summary && summary !== longContent) {
          allChunks.push(...intelligentChunk(summary, 'summary'));
        }
        
        // Content chunks
        allChunks.push(...intelligentChunk(longContent, 'content'));

        console.log(`📊 Generated ${allChunks.length} chunks for article ${article.id}`);

        // Process each chunk and generate embeddings
        let processedChunks = 0;
        for (let i = 0; i < allChunks.length; i++) {
          const chunk = allChunks[i];
          
          // Generate embedding
          const embedding = await generateEmbedding(chunk.content, OPENAI_API_KEY);
          
          if (!embedding) {
            console.warn(`⚠️ Failed to generate embedding for chunk ${i} of article ${article.id}`);
            continue;
          }

          // Insert chunk into database
          const { error: insertError } = await supabase
            .from('content_chunks')
            .insert({
              article_id: article.id,
              chunk_index: i,
              content: chunk.content,
              word_count: chunk.word_count,
              chunk_type: chunk.chunk_type,
              embedding: embedding,
              metadata: {
                original_word_count: article.word_count, // Use existing word count
                chunk_method: 'intelligent_sentence_boundary'
              }
            });

          if (insertError) {
            console.error(`❌ Error inserting chunk ${i} for article ${article.id}:`, insertError);
          } else {
            processedChunks++;
          }
        }

        results.push({
          article_id: article.id,
          chunks_created: processedChunks,
          total_word_count: article.word_count // Use existing word count
        });

        console.log(`✅ Successfully processed article ${article.id} with ${processedChunks} chunks`);

      } catch (articleError) {
        console.error(`🔥 Error processing article ${article.id}:`, articleError);
        results.push({
          article_id: article.id,
          error: articleError.message
        });
      }
    }

    return new Response(JSON.stringify({
      processed: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results: results
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
