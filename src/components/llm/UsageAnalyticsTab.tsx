
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart, LineChart, PieChart } from "recharts";
import { Bar, Line, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from "date-fns";
import { Calendar as CalendarIcon, Download, Filter } from "lucide-react";

// Mock data for visualization purposes
const mockTokenData = [
  { name: 'May 14', gpt4o: 5000, perplexity: 2000, total: 7000 },
  { name: 'May 15', gpt4o: 4000, perplexity: 3000, total: 7000 },
  { name: 'May 16', gpt4o: 6000, perplexity: 4000, total: 10000 },
  { name: 'May 17', gpt4o: 3500, perplexity: 5000, total: 8500 },
  { name: 'May 18', gpt4o: 5500, perplexity: 2500, total: 8000 },
  { name: 'May 19', gpt4o: 7000, perplexity: 3000, total: 10000 },
  { name: 'May 20', gpt4o: 6500, perplexity: 3500, total: 10000 },
];

const mockCostData = [
  { name: 'May 14', cost: 0.84 },
  { name: 'May 15', cost: 0.76 },
  { name: 'May 16', cost: 1.02 },
  { name: 'May 17', cost: 0.92 },
  { name: 'May 18', cost: 0.88 },
  { name: 'May 19', cost: 1.10 },
  { name: 'May 20', cost: 1.05 },
];

const mockModelUsage = [
  { name: 'GPT-4o', value: 37500 },
  { name: 'GPT-4o Mini', value: 15000 },
  { name: 'Perplexity', value: 23000 },
];

const mockFunctionUsage = [
  { name: 'Article Summarization', value: 30 },
  { name: 'Content Generation', value: 25 },
  { name: 'Keyword Analysis', value: 15 },
  { name: 'Research', value: 20 },
  { name: 'Other', value: 10 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function UsageAnalyticsTab() {
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  
  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedModel, setSelectedModel] = useState("all");
  const [selectedFunction, setSelectedFunction] = useState("all");

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
                {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={(range) => range && setDateRange(range)}
                numberOfMonths={2}
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
            </SelectContent>
          </Select>

          <Select value={selectedFunction} onValueChange={setSelectedFunction}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Function" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Functions</SelectItem>
              <SelectItem value="summarization">Article Summarization</SelectItem>
              <SelectItem value="generation">Content Generation</SelectItem>
              <SelectItem value="keywords">Keyword Analysis</SelectItem>
              <SelectItem value="research">Research</SelectItem>
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
              <div className="text-3xl font-bold">75,500</div>
            </CardContent>
            <CardFooter>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                +12.4% from previous period
              </Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Estimated Cost</CardTitle>
              <CardDescription>Past 7 days</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="text-3xl font-bold">$6.57</div>
            </CardContent>
            <CardFooter>
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                +8.2% from previous period
              </Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Total Requests</CardTitle>
              <CardDescription>Past 7 days</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="text-3xl font-bold">432</div>
            </CardContent>
            <CardFooter>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                +15.7% from previous period
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
                <LineChart
                  data={mockCostData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value}`} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    name="Cost (USD)" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
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
                  <span className="text-sm font-medium">1.24s</span>
                </div>
                <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                  <div className="bg-primary h-full w-[85%]" />
                </div>
                <p className="text-xs text-muted-foreground">85% of ideal performance</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Success Rate</h4>
                  <span className="text-sm font-medium">98.7%</span>
                </div>
                <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                  <div className="bg-green-500 h-full w-[98.7%]" />
                </div>
                <p className="text-xs text-muted-foreground">Percentage of requests completed successfully</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Token Efficiency</h4>
                  <span className="text-sm font-medium">92.3%</span>
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
