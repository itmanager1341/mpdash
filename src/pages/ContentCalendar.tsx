
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, FileText, Newspaper, BookOpen } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

export default function ContentCalendar() {
  const [view, setView] = useState('month');

  // Fetch articles and news for calendar
  const { data: articles } = useQuery({
    queryKey: ['calendar-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const { data: news } = useQuery({
    queryKey: ['calendar-news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('status', 'approved')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Transform data for calendar events
  const events = [
    ...(articles?.map(article => ({
      id: article.id,
      title: article.original_title || article.title,
      start: new Date(article.published_at),
      end: new Date(article.published_at),
      resource: { type: 'article', data: article }
    })) || []),
    ...(news?.map(newsItem => ({
      id: newsItem.id,
      title: newsItem.original_title,
      start: new Date(newsItem.timestamp),
      end: new Date(newsItem.timestamp),
      resource: { type: 'news', data: newsItem }
    })) || [])
  ];

  const eventStyleGetter = (event: any) => {
    const isArticle = event.resource.type === 'article';
    return {
      style: {
        backgroundColor: isArticle ? '#0F52BA' : '#1E90FF',
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Calendar</h1>
          <p className="text-muted-foreground">
            View and manage your editorial calendar across all channels
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView('month')}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            Month
          </Button>
          <Button variant="outline" onClick={() => setView('week')}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            Week
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Editorial Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: '600px' }}>
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  view={view}
                  onView={setView}
                  eventPropGetter={eventStyleGetter}
                  style={{ height: '100%' }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Content Types
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Articles</Badge>
                  <span className="text-sm">{articles?.length || 0}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">News</Badge>
                  <span className="text-sm">{news?.length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <div className="flex justify-between">
                  <span>This Month:</span>
                  <span className="font-medium">
                    {events.filter(e => 
                      moment(e.start).isSame(moment(), 'month')
                    ).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>This Week:</span>
                  <span className="font-medium">
                    {events.filter(e => 
                      moment(e.start).isSame(moment(), 'week')
                    ).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
