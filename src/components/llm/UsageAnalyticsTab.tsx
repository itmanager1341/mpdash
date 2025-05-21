
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { format, subDays } from "date-fns";
import { Calendar as CalendarIcon, Download, Filter } from "lucide-react";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { LlmUsageLog } from "@/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Mock data for visualization purposes
const mockTokenData = [
  { name: 'May 14', gpt4o: 3000, perplexity: 5000, total: 8000 },
  { name: 'May 15', gpt4o: 2000, perplexity: 6000, total: 8000 },
  { name: 'May 16', gpt4o: 3000, perplexity: 7000, total: 10000 },
  { name: 'May 17', gpt4o: 2500, perplexity: 6000, total: 8500 },
  { name: 'May 18', gpt4o: 4500, perplexity: 3500, total: 8000 },
  { name: 'May 19', gpt4o: 5000, perplexity: 5000, total: 10000 },
  { name: 'May 20', gpt4o: 4500, perplexity: 5500, total: 10000 },
];

const mockCostData = [
  { name: 'May 14', gpt4o: 0.30, perplexity: 0.54 },
  { name: 'May 15', gpt4o: 0.20, perplexity: 0.56 },
  { name: 'May 16', gpt4o: 0.30, perplexity: 0.72 },
  { name: 'May 17', gpt4o: 0.25, perplexity: 0.67 },
  { name: 'May 18', gpt4o: 0.45, perplexity: 0.43 },
  { name: 'May 19', gpt4o: 0.50, perplexity: 0.60 },
  { name: 'May 20', gpt4o: 0.45, perplexity: 0.60 },
];

const mockModelUsage = [
  { name: 'GPT-4o', value: 24500 },
  { name: 'GPT-4o Mini', value: 15000 },
  { name: 'Perplexity Sonar-Small', value: 35000 },
  { name: 'Perplexity Sonar-Large', value: 8000 },
];

const mockFunctionUsage = [
  { name: 'Article Summarization', value: 25 },
  { name: 'News Research', value: 30 },
  { name: 'Keyword Analysis', value: 15 },
  { name: 'Magazine Research', value: 20 },
  { name: 'Other', value: 10 },
];

// Mock usage logs for demonstration
const mockUsageLogs: LlmUsageLog[] = [
  { id: '1', function_name: 'magazine-research', model: 'llama-3.1-sonar-small', prompt_tokens: 1500, completion_tokens: 845, total_tokens: 2345, estimated_cost: 0.047, duration_ms: 1256, created_at: '2025-05-20T08:23:15', user_id: null },
  { id: '2', function_name: 'news-research', model: 'llama-3.1-sonar-large', prompt_tokens: 2200, completion_tokens: 1301, total_tokens: 3501, estimated_cost: 0.105, duration_ms: 1876, created_at: '2025-05-19T16:37:42', user_id: null },
  { id: '3', function_name: 'article-summarization', model: 'llama-3.1-sonar-small', prompt_tokens: 800, completion_tokens: 405, total_tokens: 1205, estimated_cost: 0.024, duration_ms: 945, created_at: '2025-05-19T11:14:33', user_id: null },
  { id: '4', function_name: 'magazine-research', model: 'llama-3.1-sonar-small', prompt_tokens: 1200, completion_tokens: 550, total_tokens: 1750, estimated_cost: 0.035, duration_ms: 1120, created_at: '2025-05-18T14:22:51', user_id: null },
  { id: '5', function_name: 'keyword-analysis', model: 'llama-3.1-sonar-small', prompt_tokens: 600, completion_tokens: 350, total_tokens: 950, estimated_cost: 0.019, duration_ms: 850, created_at: '2025-05-17T09:45:27', user_id: null }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function UsageAnalyticsTab() {
  // Update the state to use DateRange type for compatibility with react-day-picker
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  
  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedModel, setSelectedModel] = useState("all");
  const [selectedFunction, setSelectedFunction] = useState("all");
  const [usageLogs, setUsageLogs] = useState<LlmUsageLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchUsageLogs();
  }, [dateRange]);

  const fetchUsageLogs = async () => {
    try {
      setIsLoading(true);
      
      // Only proceed if we have valid from/to dates
      if (!dateRange.from || !dateRange.to) {
        return;
      }
      
      // Since the llm_usage_logs table doesn't exist in the current schema,
      // we'll use mock data instead of querying Supabase
      // In a real implementation, once the table is created, you would
      // uncomment and use this code:
      /*
      const { data, error } = await supabase
        .from('llm_usage_logs')
        .select('*')
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error("Error fetching usage logs:", error);
        return;
      }
      
      setUsageLogs(data || []);
      */
      
      // For now, use mock data
      setUsageLogs(mockUsageLogs);
    } catch (err) {
      console.error("Failed to fetch usage logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate usage statistics
  const calculateStats = () => {
    // If we have real data, use it; otherwise fall back to mock data
    if (usageLogs.length > 0) {
      const perplexityLogs = usageLogs.filter(log => 
        log.model.toLowerCase().includes('perplexity') || 
        log.model.toLowerCase().includes('sonar'));
      
      const totalTokens = usageLogs.reduce((sum, log) => sum + log.total_tokens, 0);
      const perplexityTokens = perplexityLogs.reduce((sum, log) => sum + log.total_tokens, 0);
      const totalCost = usageLogs.reduce((sum, log) => sum + log.estimated_cost, 0);
      
      return {
        totalTokens,
        perplexityTokens,
        perplexityPercentage: totalTokens ? (perplexityTokens / totalTokens) * 100 : 0,
        totalCost: totalCost.toFixed(2),
        totalRequests: usageLogs.length,
        perplexityRequests: perplexityLogs.length
      };
    }
    
    // Fall back to mock data stats
    return {
      totalTokens: 75500,
      perplexityTokens: 48000,
      perplexityPercentage: 63.6,
      totalCost: "6.57",
      totalRequests: 432,
      perplexityRequests: 275
    };
  };
  
  const stats = calculateStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <Tabs 
          value={selectedTab} 
          onValueChange={setSelectedTab}
          className="w-full md:w-auto"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tokens">Token Usage</TabsTrigger>
            <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal w-[250px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? format(dateRange.from, "MMM d, yyyy") : "Start date"} - {dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              <SelectItem value="gpt4o">GPT-4o</SelectItem>
              <SelectItem value="gpt4omini">GPT-4o Mini</SelectItem>
              <SelectItem value="perplexity">Perplexity</SelectItem>
              <SelectItem value="perplexity-sonar-small">Sonar Small</SelectItem>
              <SelectItem value="perplexity-sonar-large">Sonar Large</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedFunction} onValueChange={setSelectedFunction}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Function" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Functions</SelectItem>
              <SelectItem value="summarization">Article Summarization</SelectItem>
              <SelectItem value="news-research">News Research</SelectItem>
              <SelectItem value="magazine-research">Magazine Research</SelectItem>
              <SelectItem value="keywords">Keyword Analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <TabsContent value="overview" className="m-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Total Token Usage</CardTitle>
              <CardDescription>Past 7 days</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="text-3xl font-bold">{stats.totalTokens.toLocaleString()}</div>
            </CardContent>
            <CardFooter>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                {stats.perplexityPercentage.toFixed(1)}% from Perplexity
              </Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Estimated Cost</CardTitle>
              <CardDescription>Past 7 days</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="text-3xl font-bold">${stats.totalCost}</div>
            </CardContent>
            <CardFooter>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                Perplexity is cost-effective
              </Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Total Requests</CardTitle>
              <CardDescription>Past 7 days</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="text-3xl font-bold">{stats.totalRequests}</div>
            </CardContent>
            <CardFooter>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                {Math.round((stats.perplexityRequests / stats.totalRequests) * 100)}% Perplexity calls
              </Badge>
            </CardFooter>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Token Usage By Model</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockModelUsage}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {mockModelUsage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toLocaleString()} tokens`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Usage By Function</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockFunctionUsage}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {mockFunctionUsage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="tokens" className="m-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Daily Token Usage</CardTitle>
              <CardDescription>Token consumption broken down by model</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mockTokenData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString()} tokens`} />
                  <Legend />
                  <Bar dataKey="gpt4o" name="GPT-4o" stackId="a" fill="#0088FE" />
                  <Bar dataKey="perplexity" name="Perplexity" stackId="a" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Perplexity Calls</CardTitle>
              <CardDescription>Latest API requests to Perplexity models</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Function</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usageLogs.length > 0 ? 
                  usageLogs.filter(log => log.model.toLowerCase().includes('perplexity') || log.model.toLowerCase().includes('sonar')).slice(0, 5) : 
                  mockUsageLogs
                ).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.function_name}</TableCell>
                    <TableCell>{log.model}</TableCell>
                    <TableCell>{log.total_tokens.toLocaleString()}</TableCell>
                    <TableCell>${log.estimated_cost.toFixed(4)}</TableCell>
                    <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="costs" className="m-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Daily Cost Analysis</CardTitle>
              <CardDescription>Estimated costs based on token usage</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mockCostData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value}`} />
                  <Legend />
                  <Bar dataKey="gpt4o" name="GPT-4o" stackId="a" fill="#0088FE" />
                  <Bar dataKey="perplexity" name="Perplexity" stackId="a" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="performance" className="m-0">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Response times and success rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Average Response Time</h4>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">1.24s overall</span>
                    <Badge variant="outline" className="bg-blue-50">0.91s Perplexity</Badge>
                  </div>
                </div>
                <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                  <div className="bg-primary h-full w-[85%]" />
                </div>
                <p className="text-xs text-muted-foreground">Perplexity is typically 27% faster than OpenAI for equivalent requests</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Success Rate</h4>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">98.7% overall</span>
                    <Badge variant="outline" className="bg-blue-50">99.3% Perplexity</Badge>
                  </div>
                </div>
                <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                  <div className="bg-green-500 h-full w-[98.7%]" />
                </div>
                <p className="text-xs text-muted-foreground">Percentage of requests completed successfully</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Token Efficiency</h4>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">92.3% overall</span>
                    <Badge variant="outline" className="bg-blue-50">94.1% Perplexity</Badge>
                  </div>
                </div>
                <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                  <div className="bg-blue-500 h-full w-[92.3%]" />
                </div>
                <p className="text-xs text-muted-foreground">Ratio of useful tokens to total tokens generated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </div>
  );
}
