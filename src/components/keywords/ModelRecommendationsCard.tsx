
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Zap, Clock, Target } from "lucide-react";
import { FUNCTION_CATEGORIES } from "@/utils/functionCategories";
import { useLlmAnalytics } from "@/hooks/useLlmAnalytics";

interface ModelRecommendation {
  model: string;
  provider: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  avgLatency: string;
  strengths: string[];
  recommendation: 'effective' | 'budget' | 'balanced';
}

// Real-world pricing data (as of 2024)
const MODEL_RECOMMENDATIONS: Record<string, {
  effective: ModelRecommendation;
  budget: ModelRecommendation;
  balanced?: ModelRecommendation;
}> = {
  news_search: {
    effective: {
      model: 'llama-3.1-sonar-large-128k-online',
      provider: 'perplexity',
      inputCostPer1M: 1.00,
      outputCostPer1M: 1.00,
      avgLatency: '2-4s',
      strengths: ['Real-time search', 'Large context', 'High accuracy'],
      recommendation: 'effective'
    },
    budget: {
      model: 'llama-3.1-sonar-small-128k-online',
      provider: 'perplexity',
      inputCostPer1M: 0.20,
      outputCostPer1M: 0.20,
      avgLatency: '1-2s',
      strengths: ['Cost effective', 'Real-time search', 'Fast response'],
      recommendation: 'budget'
    }
  },
  breaking_news: {
    effective: {
      model: 'llama-3.1-sonar-huge-128k-online',
      provider: 'perplexity',
      inputCostPer1M: 5.00,
      outputCostPer1M: 5.00,
      avgLatency: '3-6s',
      strengths: ['Highest accuracy', 'Real-time data', 'Complex reasoning'],
      recommendation: 'effective'
    },
    budget: {
      model: 'llama-3.1-sonar-small-128k-online',
      provider: 'perplexity',
      inputCostPer1M: 0.20,
      outputCostPer1M: 0.20,
      avgLatency: '1-2s',
      strengths: ['Fast alerts', 'Cost effective', 'Good accuracy'],
      recommendation: 'budget'
    }
  },
  website_scraping: {
    effective: {
      model: 'gpt-4o',
      provider: 'openai',
      inputCostPer1M: 2.50,
      outputCostPer1M: 10.00,
      avgLatency: '2-5s',
      strengths: ['Complex parsing', 'Vision capability', 'High accuracy'],
      recommendation: 'effective'
    },
    budget: {
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      avgLatency: '1-2s',
      strengths: ['Very fast', 'Low cost', 'Good for simple scraping'],
      recommendation: 'budget'
    }
  },
  article_analysis: {
    effective: {
      model: 'gpt-4o',
      provider: 'openai',
      inputCostPer1M: 2.50,
      outputCostPer1M: 10.00,
      avgLatency: '2-5s',
      strengths: ['Deep analysis', 'Complex reasoning', 'High quality'],
      recommendation: 'effective'
    },
    budget: {
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      avgLatency: '1-2s',
      strengths: ['Fast analysis', 'Cost effective', 'Good insights'],
      recommendation: 'budget'
    }
  },
  content_generation: {
    effective: {
      model: 'gpt-4o',
      provider: 'openai',
      inputCostPer1M: 2.50,
      outputCostPer1M: 10.00,
      avgLatency: '3-8s',
      strengths: ['High quality writing', 'Creative content', 'Professional tone'],
      recommendation: 'effective'
    },
    budget: {
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      avgLatency: '1-3s',
      strengths: ['Fast generation', 'Low cost', 'Good quality'],
      recommendation: 'budget'
    }
  },
  editorial_research: {
    effective: {
      model: 'llama-3.1-sonar-large-128k-online',
      provider: 'perplexity',
      inputCostPer1M: 1.00,
      outputCostPer1M: 1.00,
      avgLatency: '2-4s',
      strengths: ['Real-time research', 'Large context', 'Source citations'],
      recommendation: 'effective'
    },
    budget: {
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      avgLatency: '1-2s',
      strengths: ['Fast research', 'Cost effective', 'Good synthesis'],
      recommendation: 'budget'
    }
  },
  fact_checking: {
    effective: {
      model: 'llama-3.1-sonar-large-128k-online',
      provider: 'perplexity',
      inputCostPer1M: 1.00,
      outputCostPer1M: 1.00,
      avgLatency: '2-4s',
      strengths: ['Real-time verification', 'Source access', 'High accuracy'],
      recommendation: 'effective'
    },
    budget: {
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      avgLatency: '1-2s',
      strengths: ['Fast checking', 'Low cost', 'Good logic'],
      recommendation: 'budget'
    }
  },
  seo_optimization: {
    effective: {
      model: 'gpt-4o',
      provider: 'openai',
      inputCostPer1M: 2.50,
      outputCostPer1M: 10.00,
      avgLatency: '2-4s',
      strengths: ['Advanced SEO knowledge', 'Keyword optimization', 'Technical SEO'],
      recommendation: 'effective'
    },
    budget: {
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      avgLatency: '1-2s',
      strengths: ['Basic optimization', 'Fast results', 'Cost effective'],
      recommendation: 'budget'
    }
  }
};

export default function ModelRecommendationsCard() {
  const { analytics } = useLlmAnalytics(168); // Last 7 days

  const calculateMonthlyCost = (inputCost: number, outputCost: number, avgTokens: number = 2000) => {
    // Estimate based on 30 requests per day, assuming 500 input + 1500 output tokens average
    const dailyCost = ((500 * inputCost) + (1500 * outputCost)) / 1000000 * 30;
    const monthlyCost = dailyCost * 30;
    return monthlyCost;
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'effective': return <Target className="h-4 w-4 text-green-600" />;
      case 'budget': return <DollarSign className="h-4 w-4 text-blue-600" />;
      default: return <Zap className="h-4 w-4 text-purple-600" />;
    }
  };

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case 'effective': return 'bg-green-50 text-green-700 border-green-200';
      case 'budget': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  return (
    <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Model Recommendations by Function
        </CardTitle>
        <CardDescription>
          Choose the best model for your use case based on performance, cost, and real usage data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {FUNCTION_CATEGORIES.map((category) => {
            const recommendations = MODEL_RECOMMENDATIONS[category.id];
            if (!recommendations) return null;

            return (
              <div key={category.id} className="border rounded-lg p-4 bg-white">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-semibold text-lg">{category.label}</h4>
                  <Badge variant="outline" className="text-xs">
                    {category.description}
                  </Badge>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Most Effective */}
                  <div className={`p-3 rounded-lg border ${getRecommendationColor('effective')}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {getRecommendationIcon('effective')}
                      <span className="font-medium">Most Effective</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="font-medium">{recommendations.effective.model}</div>
                      <div className="text-xs opacity-75">{recommendations.effective.provider}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="h-3 w-3" />
                        {recommendations.effective.avgLatency}
                        <DollarSign className="h-3 w-3" />
                        ${calculateMonthlyCost(
                          recommendations.effective.inputCostPer1M,
                          recommendations.effective.outputCostPer1M
                        ).toFixed(2)}/mo
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {recommendations.effective.strengths.map((strength, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {strength}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Most Budget-Friendly */}
                  <div className={`p-3 rounded-lg border ${getRecommendationColor('budget')}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {getRecommendationIcon('budget')}
                      <span className="font-medium">Most Budget-Friendly</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="font-medium">{recommendations.budget.model}</div>
                      <div className="text-xs opacity-75">{recommendations.budget.provider}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="h-3 w-3" />
                        {recommendations.budget.avgLatency}
                        <DollarSign className="h-3 w-3" />
                        ${calculateMonthlyCost(
                          recommendations.budget.inputCostPer1M,
                          recommendations.budget.outputCostPer1M
                        ).toFixed(2)}/mo
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {recommendations.budget.strengths.map((strength, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {strength}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {analytics && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h5 className="font-medium text-amber-800 mb-2">Your Usage Summary (Last 7 Days)</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-amber-600">Total Operations</div>
                <div className="font-bold text-amber-900">{analytics.operationCount}</div>
              </div>
              <div>
                <div className="text-amber-600">Total Cost</div>
                <div className="font-bold text-amber-900">${analytics.totalCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-amber-600">Avg Cost/Op</div>
                <div className="font-bold text-amber-900">
                  ${analytics.operationCount > 0 ? (analytics.totalCost / analytics.operationCount).toFixed(3) : '0.000'}
                </div>
              </div>
              <div>
                <div className="text-amber-600">Success Rate</div>
                <div className="font-bold text-amber-900">{analytics.successRate.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground">
          <p>💡 Costs are estimated based on typical usage patterns (500 input + 1500 output tokens, 30 requests/day)</p>
          <p>⚡ Latency varies based on prompt complexity and current API load</p>
          <p>📊 Recommendations based on real provider pricing as of 2024</p>
        </div>
      </CardContent>
    </Card>
  );
}
