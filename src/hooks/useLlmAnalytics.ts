
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LlmUsageLog, UsageAnalytics } from "@/types/database";
import { Json } from "@/integrations/supabase/types";

// Enhanced analytics interface with provider breakdown
interface EnhancedUsageAnalytics extends UsageAnalytics {
  providerBreakdown?: Array<{
    provider: string;
    tokens: number;
    cost: number;
    operations: number;
    costPerOperation: number;
    tokensPerDollar: number;
  }>;
  costTrends?: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  performanceMetrics?: {
    avgTokensPerSecond: number;
    costEfficiency: number;
    errorRate: number;
  };
}

export function useLlmAnalytics(timeRangeHours: number = 168) {
  const [analytics, setAnalytics] = useState<EnhancedUsageAnalytics | null>(null);
  const [recentLogs, setRecentLogs] = useState<LlmUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const startDate = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();

      const { data: logs, error: fetchError } = await supabase
        .from('llm_usage_logs')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const processedAnalytics = calculateEnhancedAnalytics(logs || []);
      setAnalytics(processedAnalytics);
      setRecentLogs((logs || []).slice(0, 20));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching LLM analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateEnhancedAnalytics = (logs: LlmUsageLog[]): EnhancedUsageAnalytics => {
    const totalTokens = logs.reduce((sum, log) => sum + log.total_tokens, 0);
    const totalCost = logs.reduce((sum, log) => sum + Number(log.estimated_cost), 0);
    const operationCount = logs.length;
    const successfulOps = logs.filter(log => log.status === 'success').length;
    const successRate = operationCount > 0 ? (successfulOps / operationCount) * 100 : 0;
    const avgDuration = logs
      .filter(log => log.duration_ms)
      .reduce((sum, log, _, arr) => sum + (log.duration_ms || 0) / arr.length, 0);

    // Enhanced function breakdown with cost efficiency metrics
    const functionStats = logs.reduce((acc, log) => {
      const key = log.function_name;
      const metadata = typeof log.operation_metadata === 'object' ? log.operation_metadata as any : {};
      
      if (!acc[key]) acc[key] = { 
        tokens: 0, 
        cost: 0, 
        operations: 0,
        totalDuration: 0,
        successCount: 0
      };
      
      acc[key].tokens += log.total_tokens;
      acc[key].cost += Number(log.estimated_cost);
      acc[key].operations += 1;
      acc[key].totalDuration += log.duration_ms || 0;
      acc[key].successCount += log.status === 'success' ? 1 : 0;
      
      return acc;
    }, {} as Record<string, any>);

    const functionBreakdown = Object.entries(functionStats).map(([function_name, stats]) => ({
      function_name,
      tokens: stats.tokens,
      cost: stats.cost,
      operations: stats.operations,
      avgDuration: Math.round(stats.totalDuration / stats.operations),
      successRate: Math.round((stats.successCount / stats.operations) * 100),
      costEfficiency: stats.tokens / (stats.cost || 0.001),
      tokensPerSecond: stats.totalDuration > 0 ? Math.round(stats.tokens / (stats.totalDuration / 1000)) : 0
    }));

    // Enhanced model breakdown with provider information
    const modelStats = logs.reduce((acc, log) => {
      const metadata = typeof log.operation_metadata === 'object' ? log.operation_metadata as any : {};
      const provider = metadata?.provider || (log.model.includes('sonar') ? 'perplexity' : 'openai');
      const key = log.model;
      
      if (!acc[key]) acc[key] = { 
        tokens: 0, 
        cost: 0, 
        operations: 0,
        model: log.model,
        provider,
        totalDuration: 0
      };
      
      acc[key].tokens += log.total_tokens;
      acc[key].cost += Number(log.estimated_cost);
      acc[key].operations += 1;
      acc[key].totalDuration += log.duration_ms || 0;
      
      return acc;
    }, {} as Record<string, any>);

    const modelBreakdown = Object.entries(modelStats).map(([model, stats]) => ({
      model: stats.model,
      provider: stats.provider,
      tokens: stats.tokens,
      cost: stats.cost,
      operations: stats.operations,
      avgDuration: Math.round(stats.totalDuration / stats.operations),
      costPerToken: stats.cost / (stats.tokens || 1),
      tokensPerDollar: (stats.tokens || 1) / (stats.cost || 0.001)
    }));

    // Provider breakdown for cost analysis
    const providerStats = logs.reduce((acc, log) => {
      const metadata = typeof log.operation_metadata === 'object' ? log.operation_metadata as any : {};
      const provider = metadata?.provider || (log.model.includes('sonar') ? 'perplexity' : 'openai');
      
      if (!acc[provider]) acc[provider] = { tokens: 0, cost: 0, operations: 0 };
      acc[provider].tokens += log.total_tokens;
      acc[provider].cost += Number(log.estimated_cost);
      acc[provider].operations += 1;
      return acc;
    }, {} as Record<string, { tokens: number; cost: number; operations: number }>);

    const providerBreakdown = Object.entries(providerStats).map(([provider, stats]) => ({
      provider,
      tokens: stats.tokens,
      cost: stats.cost,
      operations: stats.operations,
      costPerOperation: stats.cost / stats.operations,
      tokensPerDollar: stats.tokens / (stats.cost || 0.001)
    }));

    // Daily usage for charts with cost tracking
    const dailyStats = logs.reduce((acc, log) => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = { tokens: 0, cost: 0, operations: 0 };
      acc[date].tokens += log.total_tokens;
      acc[date].cost += Number(log.estimated_cost);
      acc[date].operations += 1;
      return acc;
    }, {} as Record<string, { tokens: number; cost: number; operations: number }>);

    const dailyUsage = Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Performance metrics
    const avgTokensPerSecond = logs
      .filter(log => log.duration_ms && log.total_tokens)
      .reduce((sum, log, _, arr) => sum + (log.total_tokens / (log.duration_ms! / 1000)) / arr.length, 0);

    const costEfficiency = totalTokens / (totalCost || 0.001);
    const errorRate = ((operationCount - successfulOps) / operationCount) * 100;

    return {
      totalTokens,
      totalCost,
      operationCount,
      averageDuration: avgDuration,
      successRate,
      functionBreakdown,
      modelBreakdown,
      dailyUsage,
      providerBreakdown,
      performanceMetrics: {
        avgTokensPerSecond: Math.round(avgTokensPerSecond),
        costEfficiency: Math.round(costEfficiency),
        errorRate: Math.round(errorRate * 100) / 100
      }
    };
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRangeHours]);

  return {
    analytics,
    recentLogs,
    loading,
    error,
    refetch: fetchAnalytics
  };
}
