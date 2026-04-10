// AI Insights Component for Admin
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp } from 'lucide-react';
import { getBusinessInsights } from '@/lib/ai/geminiClient';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import FeatureGate from '@/components/FeatureGate';
import DashboardLayout from '@/components/DashboardLayout';

export default function AIInsights() {
  const { restaurantId } = useAuth();
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadInsights = async () => {
    setLoading(true);
    try {
      // Fetch recent orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      // Fetch menu items
      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId);

      // Get AI insights
      const aiInsights = await getBusinessInsights(orders || [], menuItems || []);
      setInsights(aiInsights);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="AI Insights">
      <FeatureGate feature="ai_recommendations">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                AI Menu Insights
              </h2>
              <p className="text-sm text-muted-foreground">
                AI-powered recommendations
              </p>
            </div>
            
            <Button onClick={loadInsights} disabled={loading} variant="hero">
              {loading ? 'Analyzing...' : 'Get Insights'}
            </Button>
          </div>

          {insights && (
            <div className="grid gap-6">
              {/* Top Performers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    Top Performing Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {insights.topPerformers?.map((itemId: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span>{itemId}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Suggestions */}
              <Card>
                <CardHeader>
                  <CardTitle>AI Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{insights.suggestions}</p>
                  {insights.pricingTips && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      💡 {insights.pricingTips}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {!insights && !loading && (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Click "Get Insights" for AI analysis
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
