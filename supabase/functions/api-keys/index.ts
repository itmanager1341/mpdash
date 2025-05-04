import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ApiKeyOperation = 'create' | 'list' | 'delete' | 'toggle' | 'test';

interface ApiKeyRequest {
  operation: ApiKeyOperation;
  id?: string;
  name?: string;
  service?: string;
  key?: string;
  is_active?: boolean;
}

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
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let body: ApiKeyRequest;
    
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { operation } = body;
    
    if (!operation) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required field: operation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure the api_keys table exists
    await ensureApiKeysTableExists(supabase);
    
    // Process the operation
    switch (operation) {
      case 'create':
        return await handleCreateApiKey(supabase, body, corsHeaders);
      case 'list':
        return await handleListApiKeys(supabase, corsHeaders);
      case 'delete':
        return await handleDeleteApiKey(supabase, body, corsHeaders);
      case 'toggle':
        return await handleToggleApiKey(supabase, body, corsHeaders);
      case 'test':
        return await handleTestApiKey(body, corsHeaders);
      default:
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid operation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in api-keys function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function ensureApiKeysTableExists(supabase: any): Promise<void> {
  try {
    // Check if the table exists by attempting to query it
    const { error } = await supabase
      .from('api_keys')
      .select('count')
      .limit(1);
      
    if (error && error.message.includes('relation "public.api_keys" does not exist')) {
      throw new Error("The api_keys table does not exist. Please run the database setup SQL.");
    }
  } catch (error) {
    console.error("Error ensuring api_keys table exists:", error);
    throw error;
  }
}

async function handleCreateApiKey(supabase: any, body: ApiKeyRequest, corsHeaders: Record<string, string>): Promise<Response> {
  const { name, key, service } = body;
  
  // Validate input
  if (!name || !key || !service) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Missing required fields: name, key, and service are required'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate a masked version of the API key for display
  const firstChars = key.substring(0, 3);
  const lastChars = key.substring(key.length - 4);
  const maskedLength = Math.min(key.length - 7, 10);
  const keyMasked = `${firstChars}${'•'.repeat(maskedLength)}${lastChars}`;
  
  // Store API key in the project secrets
  let secretName = '';
  try {
    secretName = getSecretNameForService(service);
    
    // Set the secret using Supabase Management API
    await setSecretValue(secretName, key);
    console.log(`Successfully set secret: ${secretName}`);
  } catch (secretError) {
    console.error('Error setting secret:', secretError);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: `Failed to store API key as a secret: ${secretError instanceof Error ? secretError.message : 'Unknown error'}`,
        details: "The API key could not be stored as a Supabase secret. Please check your Supabase configuration."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Check if we need to deactivate other keys for the same service
  const singleKeyServices = ['openai', 'perplexity', 'fred'];
  if (singleKeyServices.includes(service.toLowerCase())) {
    try {
      const { error: updateError } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('service', service)
        .eq('is_active', true);
        
      if (updateError) {
        console.error("Error deactivating existing keys:", updateError);
      }
    } catch (updateError) {
      console.log('No existing keys to deactivate or error:', updateError);
    }
  }
  
  // Store API key metadata in the database
  try {
    const { data: insertedKey, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        name: name,
        service: service,
        key_masked: keyMasked,
        is_active: true
      })
      .select()
      .single();
      
    if (insertError) {
      throw new Error(`Failed to store API key metadata: ${insertError.message}`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${service} API key stored successfully`,
        key: insertedKey
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (insertError) {
    console.error("Error inserting key:", insertError);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: `Failed to store API key: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Function to set a secret value using Supabase Admin API
async function setSecretValue(secretName: string, secretValue: string): Promise<void> {
  const supabaseId = Deno.env.get('SUPABASE_PROJECT_ID') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  if (!supabaseId) {
    throw new Error('Missing SUPABASE_PROJECT_ID environment variable');
  }
  
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  
  // Set the secret directly using Deno.env in Supabase Edge Functions environment
  // This is a workaround since we can't modify environment variables at runtime
  // In production, this simulates setting the secret and the actual value will be used
  
  // Attempt to verify if we can access the current environment variables
  const currentSecrets = Object.keys(Deno.env.toObject()).filter(key => 
    !key.startsWith('SUPABASE_') && 
    !['HOME', 'PATH', 'HOSTNAME'].includes(key)
  );
  
  console.log(`Current environment has ${currentSecrets.length} secrets`);
  console.log(`Setting secret: ${secretName}`);
  
  // Using the Admin API to set secrets for Edge Functions
  const response = await fetch(`https://api.supabase.com/v1/projects/${supabaseId}/secrets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: secretName,
      value: secretValue
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to set secret: ${response.status} ${response.statusText}`);
    console.error(`Error details: ${errorText}`);
    throw new Error(`Failed to set secret: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log(`Secret ${secretName} set successfully`);
}

async function handleListApiKeys(supabase: any, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { data: keys, error: fetchError } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (fetchError) {
      throw new Error(`Failed to fetch API keys: ${fetchError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        keys: keys || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error listing API keys:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleDeleteApiKey(supabase: any, body: ApiKeyRequest, corsHeaders: Record<string, string>): Promise<Response> {
  const { id } = body;
  
  if (!id) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Missing required field: id'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Get the key info first to determine the service
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('service')
      .eq('id', id)
      .single();
      
    if (keyError) {
      throw new Error(`Failed to fetch API key data: ${keyError.message}`);
    }
    
    if (!keyData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'API key not found'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Delete the API key metadata
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id);
      
    if (error) {
      throw new Error(`Failed to delete API key: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'API key deleted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-api-key function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleToggleApiKey(supabase: any, body: ApiKeyRequest, corsHeaders: Record<string, string>): Promise<Response> {
  const { id, is_active } = body;
  
  if (id === undefined || is_active === undefined) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Missing required fields: id and is_active'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Get the key info to determine the service
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('service')
      .eq('id', id)
      .single();
      
    if (keyError) {
      throw new Error(`Failed to fetch API key data: ${keyError.message}`);
    }
    
    // If activating this key and it's a single-key service, deactivate other keys
    if (is_active) {
      const singleKeyServices = ['openai', 'perplexity', 'fred'];
      if (singleKeyServices.includes(keyData.service.toLowerCase())) {
        const { error: updateError } = await supabase
          .from('api_keys')
          .update({ is_active: false })
          .eq('service', keyData.service)
          .neq('id', id);
          
        if (updateError) {
          console.error("Error deactivating other keys:", updateError);
        }
      }
    }
    
    // Update the key status
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active })
      .eq('id', id);
      
    if (error) {
      throw new Error(`Failed to update API key status: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `API key status updated to ${is_active ? 'active' : 'inactive'}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in toggle-api-key-status function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleTestApiKey(body: ApiKeyRequest, corsHeaders: Record<string, string>): Promise<Response> {
  const { service } = body;
  
  if (!service) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Missing required field: service'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Get the appropriate API key for testing
    const secretName = getSecretNameForService(service);
    const apiKey = Deno.env.get(secretName);
    
    if (!apiKey) {
      console.log(`No API key found for ${service}. Secret name: ${secretName}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: `No API key found for ${service}`,
          details: `The API key for ${service} is not set in project secrets. Please add a key using the form below.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Test the API key based on the service
    let testResult;
    switch (service.toLowerCase()) {
      case 'perplexity':
        testResult = await testPerplexityKey(apiKey);
        break;
      case 'openai':
        testResult = await testOpenAIKey(apiKey);
        break;
      case 'fred':
        testResult = await testFredKey(apiKey);
        break;
      default:
        return new Response(
          JSON.stringify({
            success: false,
            message: `Testing for ${service} is not implemented`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
    return new Response(
      JSON.stringify(testResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error testing ${service} API key:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Helper functions
function getSecretNameForService(service: string): string {
  switch (service.toLowerCase()) {
    case 'perplexity':
      return 'PERPLEXITY_API_KEY';
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'fred':
      return 'FRED_API_KEY';
    case 'hubspot':
      return 'HUBSPOT_API_KEY';
    default:
      return `${service.toUpperCase()}_API_KEY`;
  }
}

async function testPerplexityKey(apiKey: string) {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'user',
            content: 'Say "API key is valid" if you can read this message.'
          }
        ],
        max_tokens: 20
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        message: `Perplexity API returned an error: ${response.status} ${response.statusText}`,
        details: error
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Perplexity API key is valid',
      sample_result: data.choices[0].message.content
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing Perplexity API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testOpenAIKey(apiKey: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Say "API key is valid" if you can read this message.'
          }
        ],
        max_tokens: 20
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        message: `OpenAI API returned an error: ${response.status} ${response.statusText}`,
        details: error
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'OpenAI API key is valid',
      sample_result: data.choices[0].message.content
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing OpenAI API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testFredKey(apiKey: string) {
  try {
    // Test FRED API key by fetching a simple series
    const response = await fetch(
      `https://api.stlouisfed.org/fred/series?series_id=GDPC1&api_key=${apiKey}&file_type=json`
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        message: `FRED API returned an error: ${response.status} ${response.statusText}`,
        details: error
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'FRED API key is valid',
      sample_result: `Retrieved data for series: ${data.seriess[0]?.title || 'Unknown'}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing FRED API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
