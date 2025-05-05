
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function fetchPrompts(): Promise<LlmPrompt[]> {
  const { data, error } = await supabase
    .from("llm_prompts")
    .select("*")
    .order("function_name");

  if (error) {
    console.error("Error fetching prompts:", error);
    throw error;
  }

  return data || [];
}

export async function getPromptById(id: string): Promise<LlmPrompt | null> {
  const { data, error } = await supabase
    .from("llm_prompts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching prompt:", error);
    return null;
  }

  return data;
}

export async function createPrompt(promptData: Omit<LlmPrompt, "id" | "created_at" | "updated_at" | "last_updated_by">): Promise<LlmPrompt> {
  const { data, error } = await supabase
    .from("llm_prompts")
    .insert([
      {
        ...promptData,
        last_updated_by: "system" // Replace with actual user info when auth is implemented
      }
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating prompt:", error);
    throw error;
  }

  return data;
}

export async function updatePrompt(id: string, promptData: Partial<LlmPrompt>): Promise<LlmPrompt> {
  const { data, error } = await supabase
    .from("llm_prompts")
    .update({
      ...promptData,
      updated_at: new Date().toISOString(),
      last_updated_by: "system" // Replace with actual user info when auth is implemented
    })
    .eq("id", id)
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
    .from("llm_prompts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting prompt:", error);
    throw error;
  }
}

export async function togglePromptActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("llm_prompts")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
      last_updated_by: "system" // Replace with actual user info when auth is implemented
    })
    .eq("id", id);

  if (error) {
    console.error("Error toggling prompt:", error);
    throw error;
  }
}

export async function testPrompt(testData: LlmTestInput): Promise<LlmTestResult> {
  try {
    const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
      body: testData
    });

    if (error) {
      console.error("Error testing prompt:", error);
      return {
        output: null,
        model_used: testData.model,
        error: error.message
      };
    }

    return data as LlmTestResult;
  } catch (error: any) {
    console.error("Exception testing prompt:", error);
    return {
      output: null,
      model_used: testData.model,
      error: error.message || "An unexpected error occurred"
    };
  }
}
