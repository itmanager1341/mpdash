
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
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase URL or service role key");
    }
    
    // Parse request body
    const { job_name } = await req.json();
    
    if (!job_name) {
      throw new Error("Missing job_name parameter");
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Query the scheduled_job_settings table
    const { data, error } = await supabase
      .from('scheduled_job_settings')
      .select('*')
      .eq('job_name', job_name)
      .maybeSingle();
    
    if (error) {
      throw new Error(`Failed to fetch job settings: ${error.message}`);
    }
    
    // If no settings found, return default values
    if (!data) {
      return new Response(
        JSON.stringify({
          id: '',
          job_name,
          is_enabled: true,
          schedule: '0 6 * * *', // Daily at 6am
          parameters: {
            minScore: 2.5,
            keywords: ['mortgage', 'housing market', 'federal reserve', 'interest rates'],
            limit: 20
          },
          last_run: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error in get-scheduled-job function:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
