// AI Insights Component for Admin
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { getBusinessInsights } from '@/lib/ai/geminiClient';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import FeatureGate from '@/components/FeatureGate';
import DashboardLayout from '@/components/DashboardLayout';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

export default function AIInsights() {
  const { restaurantId } = useAuth();
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      // Fetch menu items first (needed to map item IDs to names)
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('id, name, price, category')
        .eq('restaurant_id', restaurantId);

      if (menuData) {
        setMenuItems(menuData as MenuItem[]);
      }

      // Fetch recent orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, status, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      // Get AI insights
      const aiInsights = await getBusinessInsights(orders || [], menuData || []);
      setInsights(aiInsights);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get item name from ID
  const getItemName = (itemId: string): string => {
    const item = menuItems.find(m => m.id === itemId);
    return item ? item.name : itemId;
  };

  return (
    <DashboardLayout role="admin" title="AI ইনসাইটস">
      <FeatureGate feature="ai_recommendations">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                AI মেনু ইনসাইটস
              </h2>
              <p className="text-sm text-muted-foreground">
                AI-powered ব্যবসায়িক পরামর্শ
              </p>
            </div>

            <Button onClick={loadInsights} disabled={loading} variant="hero">
              {loading ? 'বিশ্লেষণ হচ্ছে...' : 'ইনসাইটস দেখুন'}
            </Button>
          </div>

          {insights && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Top Performers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    শীর্ষ পারফর্মিং আইটেম
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.topPerformers?.length > 0 ? (
                    <ul className="space-y-2">
                      {insights.topPerformers.map((itemId: string, i: number) => (
                        <li key={i} className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-medium">{getItemName(itemId)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">কোনো ডেটা নেই</p>
                  )}
                </CardContent>
              </Card>

              {/* AI Suggestions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-primary" />
                    AI পরামর্শ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.suggestions ? (
                    <p className="text-sm leading-relaxed">{insights.suggestions}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">কোনো পরামর্শ নেই</p>
                  )}
                  {insights.pricingTips && (
                    <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-primary">
                        💡 {insights.pricingTips}
                      </p>
                    </div>
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
                  "ইনসাইটস দেখুন" বাটনে ক্লিক করুন AI বিশ্লেষণের জন্য
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
