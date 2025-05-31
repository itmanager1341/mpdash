// supabase/functions/embed_articles/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.177.0/dotenv/load.ts";
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_ANON_KEY"));
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const EMBEDDING_MODEL = "text-embedding-3-small";
serve(async ()=>{
  const { data: articles, error } = await supabase.from("articles").select("id, content_variants").is("embedding", null).limit(10); // Adjust this as needed
  if (error) {
    return new Response(JSON.stringify({
      error
    }), {
      status: 500
    });
  }
  const results = [];
  for (const article of articles){
    try {
      const content = JSON.parse(article.content_variants).long || "";
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: content.slice(0, 8000)
        })
      });
      const result = await response.json();
      const embedding = result.data?.[0]?.embedding;
      if (!embedding) throw new Error("Embedding failed.");
      const { error: updateError } = await supabase.from("articles").update({
        embedding
      }).eq("id", article.id);
      if (!updateError) results.push(article.id);
    } catch (err) {
      console.error(`Failed embedding article ${article.id}:`, err.message);
    }
  }
  return new Response(JSON.stringify({
    embedded: results.length
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});
