import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Eye, EyeOff, UtensilsCrossed } from "lucide-react";

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
          // Calculate 14-day trial end date
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 14);

          // Create restaurant with trial period
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

          // Assign admin role
          await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });

          // Insert demo menu items if restaurant was created
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

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-warm items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-primary/20 blur-3xl" />
        </div>
        <div className="relative z-10 text-center max-w-md animate-fade-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-primary mb-8">
            <UtensilsCrossed className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-display font-bold text-primary-foreground mb-4">Restaurant QR</h1>
          <p className="text-lg text-primary-foreground/70 font-body">
            QR কোড দিয়ে আপনার রেস্টুরেন্টের অর্ডার ম্যানেজমেন্ট সিস্টেম। দ্রুত, সহজ এবং আধুনিক।
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-md animate-fade-up">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-primary">
              <UtensilsCrossed className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">Restaurant QR</h1>
          </div>

          <div className="mb-6">
            <h2 className="text-3xl font-display font-bold text-foreground mb-2">
              {isSignUp ? "অ্যাকাউন্ট তৈরি করুন" : "স্বাগতম"}
            </h2>
            <p className="text-muted-foreground">
              {isSignUp ? "নতুন অ্যাকাউন্ট তৈরি করতে তথ্য দিন • ১৪ দিন ফ্রি ট্রায়াল" : "আপনার ড্যাশবোর্ডে লগইন করুন"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground font-medium">আপনার নাম</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="আপনার নাম"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 bg-secondary/50 border-border focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="restaurantName" className="text-foreground font-medium">রেস্টুরেন্টের নাম <span className="text-destructive">*</span></Label>
                  <Input
                    id="restaurantName"
                    type="text"
                    placeholder="আপনার রেস্টুরেন্টের নাম"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="h-11 bg-secondary/50 border-border focus:border-primary"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="restaurantAddress" className="text-foreground font-medium">ঠিকানা</Label>
                    <Input
                      id="restaurantAddress"
                      type="text"
                      placeholder="ঠিকানা"
                      value={restaurantAddress}
                      onChange={(e) => setRestaurantAddress(e.target.value)}
                      className="h-11 bg-secondary/50 border-border focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restaurantPhone" className="text-foreground font-medium">ফোন</Label>
                    <Input
                      id="restaurantPhone"
                      type="text"
                      placeholder="+880..."
                      value={restaurantPhone}
                      onChange={(e) => setRestaurantPhone(e.target.value)}
                      className="h-11 bg-secondary/50 border-border focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground font-medium">প্যাকেজ নির্বাচন</Label>
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="h-11 bg-secondary/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">
                        <span className="font-medium">Basic — ৫০০ টাকা/মাস (১৪ দিন ফ্রি)</span>
                      </SelectItem>
                      <SelectItem value="premium">
                        <span className="font-medium">Premium — ১,০০০ টাকা/মাস (১৪ দিন ফ্রি)</span>
                      </SelectItem>
                      <SelectItem value="enterprise">
                        <span className="font-medium">Enterprise — ২,৫০০ টাকা/মাস (১৪ দিন ফ্রি)</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">সব প্যাকেজে ১৪ দিনের ফ্রি ট্রায়াল। ট্রায়াল শেষে পেমেন্ট করে প্যাকেজ চালু রাখুন।</p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">ইমেইল</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-secondary/50 border-border focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">পাসওয়ার্ড</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-secondary/50 border-border focus:border-primary pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full h-12 text-base" disabled={submitting}>
              {submitting ? "অপেক্ষা করুন..." : isSignUp ? "সাইন আপ করুন" : "লগইন করুন"}
            </Button>
          </form>

          <p className="mt-6 text-center text-muted-foreground">
            {isSignUp ? "ইতিমধ্যে অ্যাকাউন্ট আছে?" : "অ্যাকাউন্ট নেই?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline font-medium">
              {isSignUp ? "লগইন করুন" : "সাইন আপ করুন"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
