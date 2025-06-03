
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, List, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";

const ContentCalendar = () => {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Fetch scheduled content from all channels
  const { data: scheduledContent, isLoading } = useQuery({
    queryKey: ['scheduled-content'],
    queryFn: async () => {
      // Get approved news items with destinations
      const { data: newsData, error: newsError } = await supabase
        .from('news')
        .select('*')
        .eq('status', 'approved')
        .not('destinations', 'is', null);
      
      if (newsError) throw newsError;

      // Get editor briefs that are ready for publication
      const { data: briefsData, error: briefsError } = await supabase
        .from('editor_briefs')
        .select('*')
        .in('status', ['ready', 'scheduled']);
      
      if (briefsError) throw briefsError;

      // Combine and format the data using available date fields
      const allContent = [
        ...(newsData || []).map(item => ({
          id: item.id,
          title: item.editorial_headline || item.headline,
          type: 'news',
          channels: item.destinations || [],
          scheduled_date: item.timestamp || new Date().toISOString(), // Use timestamp for news items
          status: 'scheduled',
          content_variants: item.content_variants
        })),
        ...(briefsData || []).map(item => ({
          id: item.id,
          title: item.title,
          type: 'editorial',
          channels: ['mpdaily'], // Default for now
          scheduled_date: item.updated_at || new Date().toISOString(), // Use updated_at for editor briefs
          status: item.status,
          content_variants: item.content_variants
        }))
      ];

      return allContent;
    }
  });

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'mpdaily': return 'bg-blue-100 text-blue-800';
      case 'magazine': return 'bg-purple-100 text-purple-800';
      case 'website': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getContentForDate = (date: Date) => {
    if (!scheduledContent) return [];
    return scheduledContent.filter(item => 
      isSameDay(parseISO(item.scheduled_date), date)
    );
  };

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const renderCalendarView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {format(selectedDate, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        
        {monthDays.map(day => {
          const dayContent = getContentForDate(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div
              key={day.toISOString()}
              className={`p-2 min-h-24 border rounded-lg ${
                isToday ? 'bg-primary/5 border-primary' : 'border-border'
              }`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isToday ? 'text-primary' : 'text-foreground'
              }`}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayContent.map(item => (
                  <div
                    key={item.id}
                    className="text-xs p-1 rounded bg-muted truncate"
                    title={item.title}
                  >
                    {item.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderListView = () => (
    <div className="space-y-4">
      {scheduledContent && scheduledContent.length > 0 ? (
        <div className="grid gap-4">
          {scheduledContent.map(item => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">
                    {item.title}
                  </CardTitle>
                  <Badge variant={item.type === 'news' ? 'default' : 'secondary'}>
                    {item.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {item.channels.map(channel => (
                      <Badge key={channel} className={getChannelColor(channel)}>
                        {channel}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(parseISO(item.scheduled_date), 'MMM d, yyyy')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No scheduled content</h3>
          <p>Content scheduled through the planners will appear here.</p>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Content Calendar</h1>
            <p className="text-muted-foreground">
              Unified view of scheduled content across all channels
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "calendar" | "list")}>
              <TabsList>
                <TabsTrigger value="calendar">
                  <Calendar className="h-4 w-4 mr-2" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List className="h-4 w-4 mr-2" />
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      ) : (
        <Tabs value={viewMode}>
          <TabsContent value="calendar">
            {renderCalendarView()}
          </TabsContent>
          <TabsContent value="list">
            {renderListView()}
          </TabsContent>
        </Tabs>
      )}
    </DashboardLayout>
  );
};

export default ContentCalendar;
