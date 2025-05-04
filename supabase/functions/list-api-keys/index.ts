
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Check if api_keys table exists and create if it doesn't
    try {
      const { error: checkError } = await supabase
        .from('api_keys')
        .select('count')
        .limit(1)
        .catch(e => {
          console.error("Check table error:", e);
          return { error: e };
        });
        
      if (checkError && checkError.message.includes('relation "public.api_keys" does not exist')) {
        console.log("api_keys table does not exist, creating it...");
        
        // Create the table directly
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
        
        // Return empty keys array as the table was just created
        return new Response(
          JSON.stringify({ success: true, keys: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error("Error checking table:", error);
      throw new Error(`Failed to check or create api_keys table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Get all API keys
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      throw new Error(`Failed to fetch API keys: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        keys: keys || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in list-api-keys function:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
