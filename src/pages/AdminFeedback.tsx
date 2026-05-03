import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Star, MessageSquare, TrendingUp, Users, Brain, Loader2, RefreshCw, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const StarDisplay = ({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) => {
  const sz = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sz} ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
};

type FeedbackAnalysis = {
  headline: string;
  sentiment: "positive" | "neutral" | "negative";
  positive: string[];
  negative: string[];
  common_complaints: string[];
  actions: string[];
};

type FeedbackMetrics = {
  totalFeedback: number;
  commentsCount: number;
  averageRating: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
};

type FeedbackAnalysisResponse = {
  analysis?: FeedbackAnalysis;
  metrics?: FeedbackMetrics;
  source?: "gemini" | "fallback";
  generated_at?: string;
  cached?: boolean;
  error?: string;
};

const AnalysisList = ({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) => (
  <div className="rounded-lg border border-border p-3">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={`${title}-${index}`} className="text-sm text-muted-foreground flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

const AdminFeedback = () => {
  const { restaurantId } = useAuth();
  const [analysis, setAnalysis] = useState<FeedbackAnalysis | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{
    metrics?: FeedbackMetrics;
    source?: "gemini" | "fallback";
    generated_at?: string;
  }>({});
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Order-level feedback (with comments)
  const { data: orderFeedback = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["order-feedback", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, rating, rating_comment, created_at, table_id, restaurant_tables(name)")
        .eq("restaurant_id", restaurantId)
        .not("rating", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // Item-level reviews
  const { data: itemReviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ["item-reviews", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, menu_item_id, menu_items!inner(name, category, restaurant_id)")
        .eq("menu_items.restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // General restaurant feedback (not tied to any menu item)
  const { data: generalReviews = [], isLoading: loadingGeneral } = useQuery({
    queryKey: ["general-reviews", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("restaurant_id", restaurantId)
        .is("menu_item_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const totalReviews = orderFeedback.length + generalReviews.length;
  const allRatings = [
    ...orderFeedback.map((r: any) => r.rating),
    ...generalReviews.map((r: any) => r.rating),
  ];
  const avgRating =
    allRatings.length > 0
      ? Math.round((allRatings.reduce((s, v) => s + v, 0) / allRatings.length) * 10) / 10
      : null;

  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: allRatings.filter((r) => r === star).length,
  }));

  const isLoading = loadingOrders || loadingReviews || loadingGeneral;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const generateFeedbackAnalysis = async (force = false) => {
    if (!restaurantId) {
      toast.error("Restaurant context পাওয়া যায়নি");
      return;
    }

    try {
      setAnalysisLoading(true);
      const { data, error } = await supabase.functions.invoke<FeedbackAnalysisResponse>("feedback-analysis", {
        body: { restaurant_id: restaurantId, force },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.analysis) throw new Error("Feedback analysis পাওয়া যায়নি");

      setAnalysis(data.analysis);
      setAnalysisMeta({
        metrics: data.metrics,
        source: data.source,
        generated_at: data.generated_at,
      });
      toast.success(data.cached ? "Cached feedback analysis loaded" : "Feedback analysis ready");
    } catch (err: any) {
      toast.error(err.message || "Feedback analysis তৈরি করা যায়নি");
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="কাস্টমার ফিডব্যাক">
      <div className="space-y-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display font-semibold text-foreground">AI Feedback Analysis</p>
                  {analysis && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={analysis.sentiment === "positive" ? "success" : analysis.sentiment === "negative" ? "destructive" : "secondary"}>
                        {analysis.sentiment}
                      </Badge>
                      {analysisMeta.source && (
                        <span className="text-xs text-muted-foreground">
                          {analysisMeta.source === "gemini" ? "AI generated" : "Fallback analysis"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis && (
                  <Button type="button" size="sm" variant="outline" onClick={() => generateFeedbackAnalysis(true)} disabled={analysisLoading}>
                    {analysisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => generateFeedbackAnalysis(!!analysis)} disabled={analysisLoading}>
                  {analysisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  {analysisLoading ? "Analyzing..." : analysis ? "View AI Analysis" : "Analyze Feedback"}
                </Button>
              </div>
            </div>

            {analysis && (
              <div className="rounded-lg border border-border bg-background p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{analysis.headline}</p>
                    {analysisMeta.generated_at && (
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(analysisMeta.generated_at)}</p>
                    )}
                  </div>
                  {analysisMeta.metrics && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-secondary px-3 py-2">
                        <p className="text-xs text-muted-foreground">Positive</p>
                        <p className="font-semibold text-success">{analysisMeta.metrics.positiveCount}</p>
                      </div>
                      <div className="rounded-md bg-secondary px-3 py-2">
                        <p className="text-xs text-muted-foreground">Neutral</p>
                        <p className="font-semibold">{analysisMeta.metrics.neutralCount}</p>
                      </div>
                      <div className="rounded-md bg-secondary px-3 py-2">
                        <p className="text-xs text-muted-foreground">Negative</p>
                        <p className="font-semibold text-destructive">{analysisMeta.metrics.negativeCount}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <AnalysisList icon={<ThumbsUp className="h-4 w-4 text-success" />} title="Positive" items={analysis.positive} />
                  <AnalysisList icon={<ThumbsDown className="h-4 w-4 text-destructive" />} title="Negative" items={analysis.negative} />
                  <AnalysisList icon={<AlertTriangle className="h-4 w-4 text-warning" />} title="Common Complaint" items={analysis.common_complaints} />
                  <AnalysisList icon={<CheckCircle2 className="h-4 w-4 text-primary" />} title="Action" items={analysis.actions} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">মোট ফিডব্যাক</p>
              <p className="text-2xl font-bold">{totalReviews}</p>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">গড় রেটিং</p>
              <p className="text-2xl font-bold">{avgRating ?? "—"}</p>
              {avgRating && <StarDisplay rating={Math.round(avgRating)} />}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">মন্তব্যসহ</p>
              <p className="text-2xl font-bold">
                {orderFeedback.filter((r: any) => r.rating_comment).length + generalReviews.filter((r: any) => r.comment).length}
              </p>
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">৫ স্টার</p>
              <p className="text-2xl font-bold text-yellow-500">
                {allRatings.filter((r) => r === 5).length}
              </p>
              <TrendingUp className="w-4 h-4 text-yellow-500" />
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Rating Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">রেটিং বিতরণ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ratingDist.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs w-4">{star}</span>
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full transition-all"
                      style={{ width: totalReviews > 0 ? `${(count / totalReviews) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-4">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Item Reviews Summary */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">আইটেম রিভিউ সারসংক্ষেপ</CardTitle>
            </CardHeader>
            <CardContent>
              {itemReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">কোনো আইটেম রিভিউ নেই</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(
                    itemReviews.reduce((acc: Record<string, { name: string; ratings: number[] }>, r: any) => {
                      const name = r.menu_items?.name || "Unknown";
                      if (!acc[name]) acc[name] = { name, ratings: [] };
                      acc[name].ratings.push(r.rating);
                      return acc;
                    }, {})
                  )
                    .map(([, v]) => ({
                      name: v.name,
                      avg: Math.round((v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length) * 10) / 10,
                      count: v.ratings.length,
                    }))
                    .sort((a, b) => b.avg - a.avg)
                    .map((item) => (
                      <div key={item.name} className="flex items-center justify-between py-2 border-b last:border-0">
                        <span className="text-sm font-medium">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <StarDisplay rating={Math.round(item.avg)} />
                          <span className="text-xs text-muted-foreground">{item.avg} ({item.count}টি)</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* General Restaurant Feedback */}
        {generalReviews.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" /> সাধারণ ফিডব্যাক ({generalReviews.length}টি)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {generalReviews.map((fb: any) => (
                  <div key={fb.id} className="border rounded-xl p-4 space-y-2 hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StarDisplay rating={fb.rating} size="md" />
                        <span className="text-sm font-semibold text-yellow-600">{fb.rating}/5</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(fb.created_at)}
                      </span>
                    </div>
                    {fb.comment && (
                      <p className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2">
                        "{fb.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Order Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> সব অর্ডার ফিডব্যাক
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">লোড হচ্ছে...</p>
            ) : orderFeedback.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">এখনো কোনো ফিডব্যাক নেই</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orderFeedback.map((fb: any) => (
                  <div key={fb.id} className="border rounded-xl p-4 space-y-2 hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StarDisplay rating={fb.rating} size="md" />
                        <span className="text-sm font-semibold text-yellow-600">{fb.rating}/5</span>
                        {fb.restaurant_tables?.name && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            টেবিল: {fb.restaurant_tables.name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(fb.created_at)}
                      </span>
                    </div>
                    {fb.rating_comment && (
                      <p className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2">
                        "{fb.rating_comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminFeedback;
