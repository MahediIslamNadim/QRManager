import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Eye, EyeOff, UtensilsCrossed, Sparkles, ShieldCheck, Zap, QrCode } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      if (role === "super_admin") navigate("/super-admin", { replace: true });
      else if (role === "waiter") navigate("/waiter", { replace: true });
      else navigate("/admin", { replace: true });
    }
  }, [user, role, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("সব ফিল্ড পূরণ করুন");
      return;
    }
    if (isSignUp && !restaurantName.trim()) {
      toast.error("রেস্টুরেন্টের নাম দিন");
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;

        if (data.user) {
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 14);

          const { data: restaurant, error: restError } = await supabase
            .from("restaurants")
            .insert({
              name: restaurantName.trim(),
              address: restaurantAddress.trim() || null,
              phone: restaurantPhone.trim() || null,
              plan: selectedPlan,
              owner_id: data.user.id,
              status: "active",
              trial_ends_at: trialEndsAt.toISOString(),
            })
            .select()
            .single();

          if (restError) console.error("Restaurant creation error:", restError);

          await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });

          if (restaurant) {
            await supabase.from("menu_items").insert([
              { restaurant_id: restaurant.id, name: "চিকেন বিরিয়ানি", price: 350, category: "বিরিয়ানি", description: "সুগন্ধি বাসমতি চালে রান্না করা মুরগির বিরিয়ানি" },
              { restaurant_id: restaurant.id, name: "বটি কাবাব", price: 180, category: "কাবাব", description: "মশলাযুক্ত গরুর মাংসের কাবাব" },
              { restaurant_id: restaurant.id, name: "মটন বিরিয়ানি", price: 450, category: "বিরিয়ানি", description: "খাসির মাংস দিয়ে তৈরি বিরিয়ানি" },
              { restaurant_id: restaurant.id, name: "প্লেইন ভাত", price: 60, category: "ভাত", description: "সাদা ভাত" },
              { restaurant_id: restaurant.id, name: "মাংগো লাচ্ছি", price: 120, category: "পানীয়", description: "তাজা আমের লাচ্ছি" },
              { restaurant_id: restaurant.id, name: "ফিরনি", price: 100, category: "ডেজার্ট", description: "ঐতিহ্যবাহী দুধের ফিরনি" },
              { restaurant_id: restaurant.id, name: "শিক কাবাব", price: 220, category: "কাবাব", description: "কাঠকয়লায় ভাজা শিক কাবাব" },
              { restaurant_id: restaurant.id, name: "বোরহানি", price: 80, category: "পানীয়", description: "ঐতিহ্যবাহী মশলা পানীয়" },
            ]);

            await supabase.from("restaurant_tables").insert([
              { restaurant_id: restaurant.id, name: "T-1", seats: 4 },
              { restaurant_id: restaurant.id, name: "T-2", seats: 6 },
              { restaurant_id: restaurant.id, name: "T-3", seats: 2 },
              { restaurant_id: restaurant.id, name: "T-4", seats: 4 },
              { restaurant_id: restaurant.id, name: "T-5", seats: 8 },
              { restaurant_id: restaurant.id, name: "T-6", seats: 4 },
            ]);
          }

          toast.success("অ্যাকাউন্ট তৈরি হয়েছে! ১৪ দিনের ফ্রি ট্রায়াল শুরু হয়েছে।");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("স্বাগতম!");
      }
    } catch (err: any) {
      toast.error(err.message || "প্রমাণীকরণ ব্যর্থ");
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    { icon: QrCode, title: "QR অর্ডার", desc: "কাস্টমার নিজেই QR স্ক্যান করে অর্ডার দিন" },
    { icon: Zap, title: "রিয়েলটাইম", desc: "লাইভ অর্ডার ট্র্যাকিং ও নোটিফিকেশন" },
    { icon: ShieldCheck, title: "নিরাপদ", desc: "সম্পূর্ণ সুরক্ষিত ডেটা ম্যানেজমেন্ট" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Layered gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(20,35%,10%)] via-[hsl(345,40%,18%)] to-[hsl(20,30%,8%)]" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-accent/8 blur-[100px]" />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-primary/5 blur-[80px]" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(hsl(38 92% 50% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(38 92% 50% / 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Top - Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <UtensilsCrossed className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold text-white/90">Restaurant QR</span>
          </div>

          {/* Center - Main content */}
          <div className="space-y-8 animate-fade-up max-w-lg">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/20 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">১৪ দিন ফ্রি ট্রায়াল</span>
              </div>
              <h1 className="text-5xl font-display font-bold text-white leading-tight mb-4">
                আপনার রেস্টুরেন্ট,{" "}
                <span className="text-gradient">ডিজিটাল যুগে</span>
              </h1>
              <p className="text-lg text-white/50 font-body leading-relaxed">
                QR কোড দিয়ে স্মার্ট অর্ডার, রিয়েলটাইম ট্র্যাকিং, সিট ম্যানেজমেন্ট — সব এক জায়গায়।
              </p>
            </div>

            {/* Feature pills */}
            <div className="space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm transition-all hover:bg-white/[0.07]">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">{f.title}</p>
                    <p className="text-xs text-white/40">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <p className="text-xs text-white/25 font-body">
            © {new Date().getFullYear()} Restaurant QR • Powered by Lovable
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background overflow-y-auto">
        <div className="w-full max-w-[420px] animate-fade-up">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground">Restaurant QR</h1>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold text-foreground mb-2">
              {isSignUp ? "শুরু করুন" : "স্বাগতম 👋"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isSignUp ? "নতুন অ্যাকাউন্ট তৈরি করুন • ১৪ দিন ফ্রি ট্রায়াল" : "আপনার ড্যাশবোর্ডে লগইন করুন"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-foreground text-sm font-medium">আপনার নাম</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="আপনার নাম"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 bg-secondary/40 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="restaurantName" className="text-foreground text-sm font-medium">
                    রেস্টুরেন্টের নাম <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="restaurantName"
                    type="text"
                    placeholder="আপনার রেস্টুরেন্টের নাম"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="h-11 bg-secondary/40 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="restaurantAddress" className="text-foreground text-sm font-medium">ঠিকানা</Label>
                    <Input
                      id="restaurantAddress"
                      type="text"
                      placeholder="ঠিকানা"
                      value={restaurantAddress}
                      onChange={(e) => setRestaurantAddress(e.target.value)}
                      className="h-11 bg-secondary/40 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="restaurantPhone" className="text-foreground text-sm font-medium">ফোন</Label>
                    <Input
                      id="restaurantPhone"
                      type="text"
                      placeholder="+880..."
                      value={restaurantPhone}
                      onChange={(e) => setRestaurantPhone(e.target.value)}
                      className="h-11 bg-secondary/40 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm font-medium">প্যাকেজ নির্বাচন</Label>
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="h-11 bg-secondary/40 border-border/60 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">
                        <span className="font-medium">Basic — ৫০০ টাকা/মাস</span>
                      </SelectItem>
                      <SelectItem value="premium">
                        <span className="font-medium">Premium — ১,০০০ টাকা/মাস</span>
                      </SelectItem>
                      <SelectItem value="enterprise">
                        <span className="font-medium">Enterprise — ২,৫০০ টাকা/মাস</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">সব প্যাকেজে ১৪ দিনের ফ্রি ট্রায়াল অন্তর্ভুক্ত</p>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground text-sm font-medium">ইমেইল</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-secondary/40 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-foreground text-sm font-medium">পাসওয়ার্ড</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-secondary/40 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full h-12 text-base rounded-xl mt-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  অপেক্ষা করুন...
                </span>
              ) : isSignUp ? "সাইন আপ করুন" : "লগইন করুন"}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-xs text-muted-foreground">অথবা</span>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "ইতিমধ্যে অ্যাকাউন্ট আছে?" : "অ্যাকাউন্ট নেই?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:text-primary/80 font-semibold transition-colors">
              {isSignUp ? "লগইন করুন" : "সাইন আপ করুন"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
