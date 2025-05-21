
import { supabase } from "@/integrations/supabase/client";

export async function fetchPrompts(): Promise<LlmPrompt[]> {
  const { data, error } = await supabase
    .from('llm_prompts')
    .select('*')
    .order('function_name');
  
  if (error) throw error;
  return data || [];
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
