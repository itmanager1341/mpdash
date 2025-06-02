
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Activity, DollarSign, Zap, Clock, TrendingUp, AlertTriangle, Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LlmUsageLog, UsageAnalytics } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface TimeRange {
  label: string;
  value: string;
  hours: number;
}

const TIME_RANGES: TimeRange[] = [
  { label: "Last 24 Hours", value: "24h", hours: 24 },
  { label: "Last 7 Days", value: "7d", hours: 168 },
  { label: "Last 30 Days", value: "30d", hours: 720 },
  { label: "Last 90 Days", value: "90d", hours: 2160 }
];

export default function EnhancedUsageAnalyticsTab() {
  const [timeRange, setTimeRange] = useState<string>("7d");
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [recentLogs, setRecentLogs] = useState<LlmUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchAnalytics = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const selectedRange = TIME_RANGES.find(r => r.value === timeRange);
      const hoursAgo = selectedRange ? selectedRange.hours : 168;
      const startDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      // Fetch usage logs within time range
      const { data: logs, error } = await supabase
        .from('llm_usage_logs')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Type assertion to handle the Json vs Record<string, any> difference
      const typedLogs = logs as LlmUsageLog[];
      
      // Calculate analytics
      const analytics = calculateAnalytics(typedLogs || []);
      setAnalytics(analytics);
      setRecentLogs((typedLogs || []).slice(0, 20));

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch usage analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
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

    // Enhanced function breakdown with provider information
    const functionStats = logs.reduce((acc, log) => {
      const key = log.function_name;
      const metadata = typeof log.operation_metadata === 'object' ? log.operation_metadata as any : {};
      const provider = metadata?.provider || 'unknown';
      
      if (!acc[key]) acc[key] = { 
        tokens: 0, 
        cost: 0, 
        operations: 0, 
        avgDuration: 0,
        providers: new Set(),
        tokensPerSecond: 0
      };
      
      acc[key].tokens += log.total_tokens;
      acc[key].cost += Number(log.estimated_cost);
      acc[key].operations += 1;
      acc[key].avgDuration += log.duration_ms || 0;
      acc[key].providers.add(provider);
      
      if (log.duration_ms && log.total_tokens) {
        acc[key].tokensPerSecond += log.total_tokens / (log.duration_ms / 1000);
      }
      
      return acc;
    }, {} as Record<string, any>);

    const functionBreakdown = Object.entries(functionStats).map(([function_name, stats]) => ({
      function_name,
      tokens: stats.tokens,
      cost: stats.cost,
      operations: stats.operations,
      avgDuration: Math.round(stats.avgDuration / stats.operations),
      providers: Array.from(stats.providers),
      avgTokensPerSecond: Math.round(stats.tokensPerSecond / stats.operations),
      costPerOperation: stats.cost / stats.operations,
      costEfficiency: stats.tokens / (stats.cost || 0.001) // tokens per dollar
    }));

    // Enhanced model breakdown with provider grouping
    const modelStats = logs.reduce((acc, log) => {
      const metadata = typeof log.operation_metadata === 'object' ? log.operation_metadata as any : {};
      const provider = metadata?.provider || (log.model.includes('sonar') ? 'perplexity' : 'openai');
      const key = `${provider}-${log.model}`;
      
      if (!acc[key]) acc[key] = { 
        tokens: 0, 
        cost: 0, 
        operations: 0, 
        model: log.model, 
        provider,
        avgDuration: 0,
        successRate: 0
      };
      
      acc[key].tokens += log.total_tokens;
      acc[key].cost += Number(log.estimated_cost);
      acc[key].operations += 1;
      acc[key].avgDuration += log.duration_ms || 0;
      acc[key].successRate += log.status === 'success' ? 1 : 0;
      
      return acc;
    }, {} as Record<string, any>);

    const modelBreakdown = Object.entries(modelStats).map(([key, stats]) => ({
      model: stats.model,
      provider: stats.provider,
      tokens: stats.tokens,
      cost: stats.cost,
      operations: stats.operations,
      avgDuration: Math.round(stats.avgDuration / stats.operations),
      successRate: Math.round((stats.successRate / stats.operations) * 100),
      costPerToken: stats.cost / (stats.tokens || 1),
      tokensPerDollar: (stats.tokens || 1) / (stats.cost || 0.001)
    }));

    // Provider cost breakdown
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
      ...stats,
      costPerOperation: stats.cost / stats.operations,
      tokensPerDollar: stats.tokens / (stats.cost || 0.001)
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
      averageDuration: avgDuration,
      successRate,
      functionBreakdown,
      modelBreakdown,
      dailyUsage,
      providerBreakdown
    };
  };

  const exportData = () => {
    if (!analytics) return;
    
    const csvData = [
      ['Metric', 'Value'],
      ['Total Tokens', analytics.totalTokens.toString()],
      ['Total Cost', `$${analytics.totalCost.toFixed(4)}`],
      ['Operations', analytics.operationCount.toString()],
      ['Success Rate', `${analytics.successRate.toFixed(1)}%`],
      ['Avg Duration', `${analytics.averageDuration.toFixed(0)}ms`],
      [''],
      ['Function', 'Tokens', 'Cost', 'Operations'],
      ...analytics.functionBreakdown.map(f => [f.function_name, f.tokens.toString(), f.cost.toFixed(4), f.operations.toString()])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm-usage-analytics-${timeRange}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No usage data available for the selected time range.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header Controls with Cost Alerts */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {analytics.totalCost > 10 && (
            <Badge variant="destructive" className="ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              High Usage
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={exportData}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Enhanced Key Metrics Cards with Provider Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(analytics.totalTokens / analytics.operationCount).toLocaleString()} avg/op
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analytics.totalCost < 0.01 ? analytics.totalCost.toFixed(6) : analytics.totalCost.toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">
              ${(analytics.totalCost / analytics.operationCount).toFixed(6)}/op
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operations</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.operationCount}</div>
            <p className="text-xs text-muted-foreground">
              API calls made
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Operation success
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageDuration.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              Per operation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Efficiency</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analytics.totalTokens / (analytics.totalCost || 0.001)).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              tokens/$
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Detailed Analytics Tabs with Provider Analysis */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="functions">Functions</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="logs">Recent Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Usage & Cost Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'cost' ? `$${Number(value).toFixed(6)}` : value,
                        name
                      ]}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="tokens" stroke="#8884d8" name="Tokens" />
                    <Line yAxisId="left" type="monotone" dataKey="operations" stroke="#82ca9d" name="Operations" />
                    <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#ff7300" name="Cost ($)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Distribution by Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.providerBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ provider, percent }) => `${provider}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="cost"
                    >
                      {analytics.providerBreakdown?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${Number(value).toFixed(6)}`, 'Cost']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Performance & Cost Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.providerBreakdown?.map((provider, index) => (
                  <div key={provider.provider} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium capitalize">{provider.provider}</h4>
                      <Badge variant="outline">{provider.operations} ops</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Cost</p>
                        <p className="font-medium">${provider.cost.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cost/Operation</p>
                        <p className="font-medium">${provider.costPerOperation.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tokens</p>
                        <p className="font-medium">{provider.tokens.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Efficiency</p>
                        <p className="font-medium">{Math.round(provider.tokensPerDollar)} tokens/$</p>
                      </div>
                    </div>
                    <Progress 
                      value={(provider.cost / analytics.totalCost) * 100} 
                      className="mt-2" 
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="functions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Function Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.functionBreakdown.map((func, index) => (
                  <div key={func.function_name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{func.function_name}</h4>
                      <Badge variant="outline">{func.operations} ops</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Tokens</p>
                        <p className="font-medium">{func.tokens.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cost</p>
                        <p className="font-medium">${func.cost.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Cost/Op</p>
                        <p className="font-medium">${(func.cost / func.operations).toFixed(4)}</p>
                      </div>
                    </div>
                    <Progress 
                      value={(func.cost / analytics.totalCost) * 100} 
                      className="mt-2" 
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Efficiency Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analytics.modelBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="model" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tokens" fill="#8884d8" name="Tokens" />
                  <Bar dataKey="operations" fill="#82ca9d" name="Operations" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Operations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                      <div>
                        <p className="font-medium">{log.function_name}</p>
                        <p className="text-sm text-muted-foreground">{log.model}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{log.total_tokens} tokens</p>
                      <p className="text-sm text-muted-foreground">
                        ${Number(log.estimated_cost).toFixed(4)}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
