
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
    const { job_name, settings } = await req.json();
    
    if (!job_name || !settings) {
      throw new Error("Missing job_name or settings parameter");
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Check if the job exists first
    const { data: existingJob, error: checkError } = await supabase
      .from('scheduled_job_settings')
      .select('id')
      .eq('job_name', job_name)
      .maybeSingle();
    
    if (checkError) {
      throw new Error(`Failed to check existing job: ${checkError.message}`);
    }
    
    let result;
    
    // Update or insert the job settings
    if (existingJob) {
      // Update existing job
      const { error } = await supabase
        .from('scheduled_job_settings')
        .update({ 
          ...settings,
          updated_at: new Date().toISOString() 
        })
        .eq('job_name', job_name);
      
      if (error) {
        throw new Error(`Failed to update job: ${error.message}`);
      }
      
      result = { success: true, message: "Job settings updated" };
    } else {
      // Insert new job
      const { error } = await supabase
        .from('scheduled_job_settings')
        .insert({ 
          job_name, 
          ...settings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        });
      
      if (error) {
        throw new Error(`Failed to create job: ${error.message}`);
      }
      
      result = { success: true, message: "Job settings created" };
    }
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error in update-scheduled-job function:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
