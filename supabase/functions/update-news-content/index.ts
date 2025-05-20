
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/supabase

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  id: string;
  content: {
    title?: string;
    summary?: string;
    cta?: string;
    full_content?: string;
    magazine_content?: string;
  };
  newStatus?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { id, content, newStatus } = await req.json() as RequestBody;
    
    if (!id || !content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
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

    // Update the news content - using a JSONB column
    const updateData: any = {};
    
    // Update content_variants as JSONB
    const { data: existingRecord } = await supabaseClient
      .from("news")
      .select("content_variants")
      .eq("id", id)
      .single();
      
    // Merge the existing content_variants with the new content
    updateData.content_variants = {
      ...existingRecord?.content_variants,
      ...content
    };
    
    // Only update status if provided
    if (newStatus) {
      updateData.status = newStatus;
    }
    
    const { data, error } = await supabaseClient
      .from("news")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
          }).then((res) => res.json());
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
            return { data: data[0], error: null };
          },
        }),
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          select: (columns: string = "*") => ({
            single: async () => {
              const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}&select=${columns}`, {
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
              return { data: resData[0], error: null };
            }
          }),
        }),
      }),
    }),
  };
}
