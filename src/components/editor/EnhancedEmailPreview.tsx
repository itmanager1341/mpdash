
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Monitor, Smartphone, TrendingUp } from "lucide-react";

interface EnhancedEmailPreviewProps {
  headline: string;
  summary: string;
  cta: string;
  fullContent: string;
  source: string;
  timestamp: string;
}

export function EnhancedEmailPreview({ 
  headline, 
  summary, 
  cta, 
  fullContent, 
  source, 
  timestamp 
}: EnhancedEmailPreviewProps) {
  
  const getEngagementPrediction = () => {
    // Simple heuristic based on content quality
    const headlineScore = headline.length > 30 && headline.length < 80 ? 30 : 20;
    const ctaScore = cta.includes('?') || cta.includes('!') ? 25 : 15;
    const contentScore = fullContent.length > 200 ? 25 : 15;
    const urgencyScore = headline.toLowerCase().includes('new') || headline.toLowerCase().includes('now') ? 20 : 10;
    
    return Math.min(headlineScore + ctaScore + contentScore + urgencyScore, 100);
  };

  const engagementScore = getEngagementPrediction();

  return (
    <div className="space-y-4">
      {/* Engagement Prediction */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-900">Engagement Prediction</span>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {engagementScore}% Score
            </Badge>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Based on headline optimization, CTA effectiveness, and content quality
          </p>
        </CardContent>
      </Card>

      {/* Preview Tabs */}
      <Tabs defaultValue="desktop" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="desktop" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Desktop
          </TabsTrigger>
          <TabsTrigger value="mobile" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Mobile
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="desktop" className="mt-4">
          <Card className="max-w-2xl mx-auto">
            <div className="bg-[#f8f9fa] p-4 border-b">
              <div className="text-xs text-gray-500 mb-1">From: MortgagePoint Daily &lt;daily@mortgagepoint.com&gt;</div>
              <div className="text-xs text-gray-500 mb-2">Subject: MPDaily - {new Date().toLocaleDateString()}</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{headline}</h2>
            </div>
            
            <CardContent className="p-6 bg-white">
              <div className="space-y-4">
                <p className="text-sm text-gray-600 italic border-l-4 border-blue-500 pl-4">
                  {cta}
                </p>
                
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: fullContent }}
                />
                
                <div className="border-t pt-4 mt-6">
                  <div className="text-xs text-gray-500">
                    Source: {source} | {new Date(timestamp).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                  <Button className="w-full">
                    Read Full Article on MortgagePoint.com
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="mobile" className="mt-4">
          <Card className="max-w-sm mx-auto">
            <div className="bg-[#f8f9fa] p-3 border-b">
              <div className="text-xs text-gray-500 mb-1 truncate">MPDaily - {new Date().toLocaleDateString()}</div>
              <h2 className="text-lg font-bold text-gray-900 mb-1 leading-tight">{headline}</h2>
            </div>
            
            <CardContent className="p-4 bg-white">
              <div className="space-y-3">
                <p className="text-sm text-gray-600 italic border-l-2 border-blue-500 pl-3">
                  {cta}
                </p>
                
                <div 
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: fullContent.substring(0, 300) + '...' }}
                />
                
                <Button className="w-full text-sm" size="sm">
                  Read More
                </Button>
                
                <div className="text-xs text-gray-500 pt-2 border-t">
                  {source} | {new Date(timestamp).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
