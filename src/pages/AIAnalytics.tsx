import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import FeatureGate from "@/components/FeatureGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Brain, LineChart, Loader2, Sparkles, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type AIInsights = {
  suggestions?: string;
  pricingTips?: string;
  marketingTips?: string;
  forecastTip?: string;
  menuOptimization?: string;
  predictiveForecast?: string;
  actionItems?: string[];
};

const fallbackInsights: Required<AIInsights> = {
  suggestions: "Best selling items stock-e rakun, peak hour-e staff ready rakun, and slow items er offer test korun.",
  pricingTips: "Average order value barate combo item, add-on, and family bundle test korte paren.",
  marketingTips: "Repeat customer der jonno weekly offer and lunch/dinner time targeted promotion chalate paren.",
  forecastTip: "Recent order trend follow kore next week-er busy day and high demand item plan korun.",
  menuOptimization: "Low selling items review korun and top items menu-te more visible position-e rakun.",
  predictiveForecast: "More order data collect hole forecast aro accurate hobe. Current trend diye next 1-2 week inventory plan korte paren.",
  actionItems: [
    "Top selling items stock check korun",
    "Peak hour staffing plan update korun",
    "Low selling items-er price/promotion review korun",
    "Combo offer A/B test korun",
  ],
};

export default function AIAnalytics() {
  const { restaurantId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Required<AIInsights> | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadInsights = async () => {
    if (!restaurantId) {
      toast.error("No restaurant context found");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analytics", {
        body: { restaurant_id: restaurantId },
      });

      if (error) throw error;

      setInsights({
        ...fallbackInsights,
        ...(data?.insights || {}),
        actionItems: data?.insights?.actionItems?.length ? data.insights.actionItems : fallbackInsights.actionItems,
      });
      setLastUpdated(new Date().toLocaleString("bn-BD"));
    } catch (error: any) {
      setInsights(fallbackInsights);
      toast.warning(error?.message || "AI analytics fallback loaded");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="AI অ্যানালিটিক্স">
      <FeatureGate feature="ai_analytics" restaurantId={restaurantId}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">AI অ্যানালিটিক্স</h2>
                  <p className="text-sm text-muted-foreground">High Smart package-এর advanced restaurant insights</p>
                </div>
              </div>
              {lastUpdated && <p className="text-xs text-muted-foreground mt-2">Last updated: {lastUpdated}</p>}
            </div>

            <Button onClick={loadInsights} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Analyzing..." : "Generate AI Insights"}
            </Button>
          </div>

          {!insights && (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center space-y-4">
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <LineChart className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">High Smart AI অ্যানালিটিক্স ready</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Restaurant order, menu, revenue and demand data analyze kore smart recommendation generate korbe.
                  </p>
                </div>
                <Button onClick={loadInsights} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Start Analysis
                </Button>
              </CardContent>
            </Card>
          )}

          {insights && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-success" />
                      Business Growth
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-6">{insights.suggestions}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Pricing Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-6">{insights.pricingTips}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-warning" />
                      Marketing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-6">{insights.marketingTips}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Forecast & Menu Optimization</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Badge variant="secondary">Forecast</Badge>
                      <p className="text-sm text-muted-foreground mt-2 leading-6">{insights.predictiveForecast}</p>
                    </div>
                    <div>
                      <Badge variant="secondary">Menu</Badge>
                      <p className="text-sm text-muted-foreground mt-2 leading-6">{insights.menuOptimization}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Action Items</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {insights.actionItems.map((item, index) => (
                      <div key={index} className="flex gap-3 rounded-lg bg-secondary/50 p-3">
                        <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <p className="text-sm text-foreground">{item}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
