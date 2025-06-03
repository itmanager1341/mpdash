
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

export function extractPromptMetadata(prompt: LlmPrompt | null) {
  if (!prompt?.prompt_text) return null;
  
  const metadataMatch = prompt.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
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
  
  // Also check model types commonly used for news search
  if (prompt.model && (
      prompt.model.includes('sonar') ||
      prompt.model.includes('online') ||
      prompt.model.includes('perplexity')
    )) {
    return true;
  }
  
  // Also check by name convention
  return prompt.function_name?.toLowerCase().includes('news_search');
}

export function filterNewsSearchPrompts(prompts: LlmPrompt[]): LlmPrompt[] {
  return prompts.filter(isNewsSearchPrompt);
}

export function calculateClusterWeightDistribution(clusters: any[], selectedThemes: string[] = []) {
  const filteredClusters = selectedThemes.length > 0 
    ? clusters.filter(c => selectedThemes.includes(c.primary_theme))
    : clusters;
    
  const totalWeight = filteredClusters.reduce((sum, cluster) => sum + (cluster.priority_weight || 50), 0);
  
  return filteredClusters.map(cluster => ({
    ...cluster,
    weightPercentage: totalWeight > 0 ? Math.round((cluster.priority_weight || 50) / totalWeight * 100) : 0,
    keywordAllocation: Math.max(3, Math.round(((cluster.priority_weight || 50) / 100) * 12))
  }));
}

export function generateWeightedScoringCriteria(clusters: any[], selectedThemes: string[] = []) {
  const weightedClusters = calculateClusterWeightDistribution(clusters, selectedThemes);
  
  // Group by weight tiers
  const highPriority = weightedClusters.filter(c => (c.priority_weight || 50) >= 70);
  const mediumPriority = weightedClusters.filter(c => (c.priority_weight || 50) >= 40 && (c.priority_weight || 50) < 70);
  const lowPriority = weightedClusters.filter(c => (c.priority_weight || 50) < 40);
  
  return {
    highPriority: highPriority.map(c => c.primary_theme),
    mediumPriority: mediumPriority.map(c => c.primary_theme),
    lowPriority: lowPriority.map(c => c.primary_theme),
    scoringPercentages: {
      high: Math.max(30, Math.min(50, highPriority.length * 10)),
      regulatory: 25,
      market: 20,
      technology: 15,
      competitive: Math.max(5, 30 - highPriority.length * 5)
    }
  };
}
