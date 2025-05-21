
import { supabase } from "@/integrations/supabase/client";

export async function fetchPrompts(): Promise<LlmPrompt[]> {
  const { data, error } = await supabase
    .from('llm_prompts')
    .select('*')
    .order('function_name');
  
  if (error) {
    console.error("Error fetching prompts:", error);
    throw error;
  }
  return data || [];
}

export async function createPrompt(promptData: LlmPromptFormData): Promise<LlmPrompt> {
  const { data, error } = await supabase
    .from('llm_prompts')
    .insert([promptData])
    .select()
    .single();
  
  if (error) {
    console.error("Error creating prompt:", error);
    throw error;
  }
  return data;
}

export async function updatePrompt(id: string, promptData: LlmPromptFormData): Promise<LlmPrompt> {
  const { data, error } = await supabase
    .from('llm_prompts')
    .update(promptData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating prompt:", error);
    throw error;
  }
  return data;
}

export async function deletePrompt(id: string): Promise<void> {
  const { error } = await supabase
    .from('llm_prompts')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error("Error deleting prompt:", error);
    throw error;
  }
}

export async function togglePromptActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('llm_prompts')
    .update({ is_active: isActive })
    .eq('id', id);
  
  if (error) {
    console.error("Error toggling prompt activity:", error);
    throw error;
  }
}

export async function testPrompt(testData: LlmTestInput): Promise<LlmTestResult> {
  // Call the Supabase Edge Function for testing prompts
  try {
    const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
      body: testData
    });
    
    if (error) throw error;
    
    return data || {
      output: "Error: No response from test function",
      model_used: testData.model
    };
  } catch (error) {
    console.error("Error testing prompt:", error);
    throw error;
  }
}

export function extractPromptMetadata(prompt: LlmPrompt) {
  const metadataMatch = prompt?.prompt_text?.match(/\/\*\n([\s\S]*?)\n\*\//);
  if (metadataMatch) {
    try {
      return JSON.parse(metadataMatch[1]);
    } catch (e) {
      console.error("Error parsing prompt metadata:", e);
      return null;
    }
  }
  return null;
}

export function isNewsSearchPrompt(prompt: LlmPrompt): boolean {
  // Check if prompt has news search metadata
  const metadata = extractPromptMetadata(prompt);
  if (metadata?.search_settings?.is_news_search === true) {
    return true;
  }
  
  // Also check by name convention
  return prompt.function_name?.toLowerCase().includes('news_search');
}

export function filterNewsSearchPrompts(prompts: LlmPrompt[]): LlmPrompt[] {
  return prompts.filter(isNewsSearchPrompt);
}
