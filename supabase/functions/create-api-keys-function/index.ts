
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
    
    // Create table_creation helper function in PostgreSQL
    const { error: functionError } = await supabase.sql(`
      CREATE OR REPLACE FUNCTION public.create_table_if_not_exists(
        table_name TEXT,
        table_definition TEXT
      ) RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE format('
          CREATE TABLE IF NOT EXISTS public.%I (
            %s
          )', table_name, table_definition);
        RETURN TRUE;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE;
      END;
      $$;
    `);
    
    if (functionError) {
      throw new Error(`Failed to create helper function: ${functionError.message}`);
    }
    
    // Create the api_keys table using the helper function
    const { data, error: tableError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'api_keys',
      table_definition: `
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        service TEXT NOT NULL,
        key_masked TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      `
    });
    
    if (tableError) {
      throw new Error(`Failed to create api_keys table: ${tableError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "API keys table function and table created successfully"
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
