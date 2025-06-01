
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LlmUsageLog, UsageAnalytics } from "@/types/database";
import { Json } from "@/integrations/supabase/types";

export function useLlmAnalytics(timeRangeHours: number = 168) {
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
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

      const processedAnalytics = calculateAnalytics(logs || []);
      setAnalytics(processedAnalytics);
      setRecentLogs((logs || []).slice(0, 20));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching LLM analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (logs: LlmUsageLog[]): UsageAnalytics => {
    const totalTokens = logs.reduce((sum, log) => sum + log.total_tokens, 0);
    const totalCost = logs.reduce((sum, log) => sum + Number(log.estimated_cost), 0);
    const operationCount = logs.length;
    const successfulOps = logs.filter(log => log.status === 'success').length;
    const successRate = operationCount > 0 ? (successfulOps / operationCount) * 100 : 0;
    const avgDuration = logs
      .filter(log => log.duration_ms)
      .reduce((sum, log, _, arr) => sum + (log.duration_ms || 0) / arr.length, 0);

    // Function breakdown
    const functionStats = logs.reduce((acc, log) => {
      const key = log.function_name;
      if (!acc[key]) acc[key] = { tokens: 0, cost: 0, operations: 0 };
      acc[key].tokens += log.total_tokens;
      acc[key].cost += Number(log.estimated_cost);
      acc[key].operations += 1;
      return acc;
    }, {} as Record<string, { tokens: number; cost: number; operations: number }>);

    const functionBreakdown = Object.entries(functionStats).map(([function_name, stats]) => ({
      function_name,
      ...stats
    }));

    // Model breakdown
    const modelStats = logs.reduce((acc, log) => {
      const key = log.model;
      if (!acc[key]) acc[key] = { tokens: 0, cost: 0, operations: 0 };
      acc[key].tokens += log.total_tokens;
      acc[key].cost += Number(log.estimated_cost);
      acc[key].operations += 1;
      return acc;
    }, {} as Record<string, { tokens: number; cost: number; operations: number }>);

    const modelBreakdown = Object.entries(modelStats).map(([model, stats]) => ({
      model,
      ...stats
    }));

    // Daily usage for charts
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

    return {
      totalTokens,
      totalCost,
      operationCount,
      averageDuration: avgDuration, // Fixed variable name from averageDuration to avgDuration
      successRate,
      functionBreakdown,
      modelBreakdown,
      dailyUsage
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
