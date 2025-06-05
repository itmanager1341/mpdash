
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      manual = false, 
      promptId, 
      modelOverride, 
      limit = 20,
      triggeredBy = 'manual'
    } = await req.json();

    console.log('News import request:', { manual, promptId, modelOverride, limit, triggeredBy });

    // Log job execution start
    const { data: logData, error: logError } = await supabase.rpc('log_job_execution', {
      p_job_name: promptId ? `news_search_${promptId}` : 'manual_news_import',
      p_execution_type: manual ? 'manual' : 'scheduled',
      p_status: 'running',
      p_message: 'Starting news import process',
      p_parameters_used: { promptId, modelOverride, limit, triggeredBy }
    });

    if (logError) {
      console.error('Error logging job execution:', logError);
    }

    const logId = logData;

    try {
      // Get the prompt if specified
      let prompt = null;
      if (promptId) {
        const { data: promptData, error: promptError } = await supabase
          .from('llm_prompts')
          .select('*')
          .eq('id', promptId)
          .eq('is_active', true)
          .single();

        if (promptError) {
          throw new Error(`Failed to fetch prompt: ${promptError.message}`);
        }

        prompt = promptData;
      }

      // Determine which model to use
      let modelToUse = modelOverride;
      if (!modelToUse && prompt) {
        modelToUse = prompt.model;
      }
      if (!modelToUse) {
        modelToUse = 'llama-3.1-sonar-small-128k-online'; // Default fallback
      }

      console.log('Using model:', modelToUse);

      // Route to appropriate provider based on model
      let importResult;
      if (modelToUse.includes('sonar') || modelToUse.includes('perplexity')) {
        // Call Perplexity-specific function
        const perplexityResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-perplexity-news`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt?.prompt_text || 'Search for the latest mortgage industry news',
            model: modelToUse,
            limit,
            promptId,
            triggeredBy
          })
        });

        if (!perplexityResponse.ok) {
          throw new Error(`Perplexity fetch failed: ${perplexityResponse.statusText}`);
        }

        importResult = await perplexityResponse.json();
      } else if (modelToUse.includes('gpt')) {
        // Future: Route to OpenAI search function
        throw new Error('OpenAI news search not yet implemented');
      } else {
        throw new Error(`Unsupported model for news search: ${modelToUse}`);
      }

      // Update job execution status to success
      if (logId) {
        await supabase.rpc('update_job_execution_status', {
          p_log_id: logId,
          p_status: 'success',
          p_message: `Successfully imported ${importResult.articles_inserted || 0} articles`,
          p_details: importResult
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `News import completed successfully`,
        details: importResult,
        model_used: modelToUse,
        prompt_used: prompt?.function_name || 'default'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Error in news import:', error);
      
      // Update job execution status to error
      if (logId) {
        await supabase.rpc('update_job_execution_status', {
          p_log_id: logId,
          p_status: 'error',
          p_message: error.message,
          p_details: { error: error.message, stack: error.stack }
        });
      }

      throw error;
    }

  } catch (error) {
    console.error('Error in run-news-import function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
