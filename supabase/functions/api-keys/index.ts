
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
    await ensureApiKeysTableExists(supabase, supabaseUrl, serviceRoleKey);
    
    // Process the operation
    switch (operation) {
      case 'create':
        return await handleCreateApiKey(supabase, body, corsHeaders, supabaseUrl);
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

async function ensureApiKeysTableExists(supabase: any, supabaseUrl: string, serviceRoleKey: string): Promise<void> {
  try {
    // Check if the table exists by attempting to query it
    const { error } = await supabase
      .from('api_keys')
      .select('count')
      .limit(1);
      
    if (error && error.message.includes('relation "public.api_keys" does not exist')) {
      console.log("Creating api_keys table as it doesn't exist");
      
      // Create the table directly
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS public.api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          service TEXT NOT NULL,
          key_masked TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          secret_stored BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      
      try {
        // Extract project ID from the URL
        const urlParts = supabaseUrl.split('.');
        if (urlParts.length < 3) {
          throw new Error(`Invalid SUPABASE_URL format: ${supabaseUrl}`);
        }
        
        const projectId = urlParts[0].replace('https://', '');
        if (!projectId) {
          throw new Error('Could not extract project ID from SUPABASE_URL');
        }
        
        // Using the pgrest API to execute SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            source: createTableQuery
          }),
        });
        
        if (!response.ok) {
          // If the RPC method doesn't exist or fails, try using Deno's Postgres client as a fallback
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
        } else {
          console.log("Table created successfully via REST API");
        }
      } catch (pgError) {
        console.error("Error creating table:", pgError);
        throw new Error(`Failed to create api_keys table: ${pgError instanceof Error ? pgError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error("Error ensuring api_keys table exists:", error);
    throw error;
  }
}

async function handleCreateApiKey(
  supabase: any, 
  body: ApiKeyRequest, 
  corsHeaders: Record<string, string>,
  supabaseUrl: string
): Promise<Response> {
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
  let secretStored = false;
  
  try {
    secretName = getSecretNameForService(service);
    
    // Extract project ID from the URL
    const projectId = supabaseUrl.split('.')[0].replace('https://', '');
    if (!projectId) {
      throw new Error('Could not extract project ID from SUPABASE_URL');
    }
    
    console.log(`Setting secret ${secretName} for project ${projectId}`);
    
    // Store the secret using Admin API with the new SB_ADMIN_KEY
    const adminKey = Deno.env.get('SB_ADMIN_KEY');
    if (!adminKey) {
      throw new Error('Missing SB_ADMIN_KEY. Please add this secret to your Supabase Edge Function secrets.');
    }
    
    // Store the secret using Admin API
    await setSecretValueWithAdminKey(projectId, adminKey, secretName, key);
    secretStored = true;
    console.log(`Successfully set secret: ${secretName}`);
  } catch (secretError) {
    console.error('Error setting secret:', secretError);
    // We'll continue with database storage even if setting the secret fails
    console.warn('Secret storage failed but continuing with database storage');
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
        is_active: true,
        secret_stored: secretStored
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
        key: insertedKey,
        secret_stored: secretStored
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

// Updated function to fix the API call format
async function setSecretValueWithAdminKey(projectId: string, adminKey: string, secretName: string, secretValue: string): Promise<void> {
  if (!projectId) {
    throw new Error('Missing project ID');
  }
  
  if (!adminKey) {
    throw new Error('Missing SB_ADMIN_KEY');
  }
  
  console.log(`Setting secret ${secretName} for project ${projectId} using admin key`);
  
  // Fix: The API expects an array of secrets, not a single object
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/secrets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{  // Note the array wrapper here
      name: secretName,
      value: secretValue
    }])
  });
  
  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
    } catch (e) {
      errorText = "Could not extract error text";
    }
    
    console.error(`Failed to set secret: ${response.status} ${response.statusText}`);
    console.error(`Error details: ${errorText}`);
    throw new Error(`Failed to set secret: ${response.status} ${response.statusText} - ${errorText}`);
  }
}

// Keep existing function for backward compatibility but don't use it
async function setSecretValueDirect(projectId: string, serviceRoleKey: string, secretName: string, secretValue: string): Promise<void> {
  console.log('This function is deprecated, use setSecretValueWithAdminKey instead');
  throw new Error('This function is deprecated, use setSecretValueWithAdminKey instead');
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
    console.error('Error in delete API key operation:', error);
    
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
    console.error('Error in toggle API key status operation:', error);
    
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
      const statusCode = response.status;
      
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      let errorDetails = error;
      
      // Provide more specific error messages based on status codes
      if (statusCode === 401) {
        errorMessage = 'Authentication failed: Invalid API key';
        errorDetails = 'The API key appears to be invalid or has been revoked. Please check your key and try again.';
      } else if (statusCode === 403) {
        errorMessage = 'Access forbidden: Insufficient permissions';
        errorDetails = 'Your API key does not have permission to access this resource.';
      } else if (statusCode === 429) {
        errorMessage = 'Rate limit exceeded';
        errorDetails = 'You have made too many requests. Please wait and try again later.';
      }
      
      return {
        success: false,
        message: errorMessage,
        details: errorDetails
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
      const statusCode = response.status;
      
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      let errorDetails = error;
      
      // Provide more specific error messages based on status codes
      if (statusCode === 401) {
        errorMessage = 'Authentication failed: Invalid API key';
        errorDetails = 'The API key appears to be invalid or has been revoked. Please check your key and try again.';
      } else if (statusCode === 429) {
        errorMessage = 'Rate limit exceeded';
        errorDetails = 'You have made too many requests. Please wait and try again later.';
      }
      
      return {
        success: false,
        message: errorMessage,
        details: errorDetails
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
      const statusCode = response.status;
      
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      let errorDetails = error;
      
      // Provide more specific error messages based on status codes
      if (statusCode === 400 || statusCode === 401) {
        errorMessage = 'Authentication failed: Invalid API key';
        errorDetails = 'The API key appears to be invalid or has been revoked. Please check your key and try again.';
      } else if (statusCode === 429) {
        errorMessage = 'Rate limit exceeded';
        errorDetails = 'You have made too many requests. Please wait and try again later.';
      }
      
      return {
        success: false,
        message: errorMessage,
        details: errorDetails
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'FRED API key is valid',
      sample_result: `Retrieved data for series: ${data.seriess?.[0]?.title || 'Unknown'}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing FRED API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
