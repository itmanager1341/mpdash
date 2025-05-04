
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Set up Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase URL or service role key");
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Create the api_keys table directly with SQL
    const { error: tableError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'api_keys',
      table_definition: `
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        service TEXT NOT NULL,
        key_masked TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      `
    }).catch(e => {
      console.error("RPC error:", e);
      return { error: e };
    });
    
    if (tableError) {
      console.log("RPC failed, trying direct SQL");
      
      // Try with simple query - this should be supported
      const { error: queryError } = await supabase
        .from('api_keys')
        .select('count')
        .limit(1)
        .catch(e => {
          console.error("Query error:", e);
          return { error: e };
        });
      
      if (queryError && queryError.message.includes('relation "public.api_keys" does not exist')) {
        // Create the table manually since the table doesn't exist
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS public.api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            service TEXT NOT NULL,
            key_masked TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `;
        
        try {
          // Using Deno's Postgres client as a fallback
          const pgConnection = Deno.env.get('SUPABASE_DB_URL');
          
          if (!pgConnection) {
            throw new Error("Cannot access database directly - missing connection string");
          }
          
          // Import Postgres client dynamically
          const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
          
          const pool = new Pool(pgConnection, 1, true);
          const connection = await pool.connect();
          
          try {
            await connection.queryObject(createTableQuery);
            console.log("Table created successfully via Postgres client");
          } finally {
            connection.release();
            await pool.end();
          }
        } catch (pgError) {
          console.error("Failed to create table with Postgres client:", pgError);
          throw new Error(`Failed to create api_keys table: ${pgError.message}`);
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "API keys table created successfully"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error creating API keys function:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
