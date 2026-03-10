import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { UtensilsCrossed, ArrowRight, Smartphone, ChefHat, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const floatingEmojis = ["🍛", "🍕", "🍜", "🥘", "🍱", "🥗", "🍔", "🍣", "🧁", "🍝"];

interface FloatingEmoji {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

const Index = () => {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    const generated: FloatingEmoji[] = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      emoji: floatingEmojis[i % floatingEmojis.length],
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 12 + Math.random() * 10,
      size: 20 + Math.random() * 24,
    }));
    setEmojis(generated);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Floating food emojis background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {emojis.map((e) => (
          <span
            key={e.id}
            className="absolute opacity-[0.12] select-none"
            style={{
              left: `${e.left}%`,
              bottom: "-60px",
              fontSize: `${e.size}px`,
              animation: `floatUp ${e.duration}s ${e.delay}s linear infinite`,
            }}
          >
            {e.emoji}
          </span>
        ))}
      </div>

      {/* Navbar */}
      <nav className="border-b border-border/50 bg-card/60 backdrop-blur-2xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-sunset flex items-center justify-center shadow-lg shadow-primary/30">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-foreground text-xl tracking-tight">Tasty QR Spot</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/menu/demo">ডেমো মেনু</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/login">লগইন</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center">
        {/* Warm gradient overlays */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-b from-primary/8 via-transparent to-accent/5" />
          <div className="absolute top-16 left-[10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-10 right-[10%] w-[400px] h-[400px] rounded-full bg-accent/8 blur-[100px]" />
          <div className="absolute top-1/3 right-1/3 w-[300px] h-[300px] rounded-full bg-warning/6 blur-[80px]" />
          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-6 py-20 relative z-10 text-center">
          {/* Glowing logo */}
          <div className="animate-fade-up" style={{ animationDelay: "0s" }}>
            <div className="relative inline-flex mb-8">
              <div className="w-24 h-24 rounded-3xl gradient-sunset flex items-center justify-center shadow-2xl relative z-10"
                style={{ boxShadow: "0 0 60px hsl(38 92% 50% / 0.4), 0 0 120px hsl(345 65% 35% / 0.2)" }}>
                <UtensilsCrossed className="w-12 h-12 text-white" />
              </div>
              <div className="absolute inset-0 rounded-3xl gradient-sunset opacity-40 blur-2xl animate-pulse" />
            </div>
          </div>

          {/* Badge */}
          <div className="animate-fade-up" style={{ animationDelay: "0.1s", opacity: 0, animationFillMode: "forwards" }}>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent-foreground text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              বাংলাদেশের #১ রেস্টুরেন্ট সলিউশন
            </div>
          </div>

          {/* Headline */}
          <div className="animate-fade-up" style={{ animationDelay: "0.2s", opacity: 0, animationFillMode: "forwards" }}>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold text-foreground leading-[1.1] mb-6">
              স্মার্ট রেস্টুরেন্ট{" "}
              <span className="text-gradient-sunset">অর্ডারিং</span>{" "}
              সিস্টেম
            </h1>
          </div>

          {/* Subheadline */}
          <div className="animate-fade-up" style={{ animationDelay: "0.35s", opacity: 0, animationFillMode: "forwards" }}>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto font-body leading-relaxed">
              QR কোড স্ক্যান করুন, মেনু দেখুন, অর্ডার দিন — <span className="text-foreground font-semibold">সহজেই!</span>
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="animate-fade-up flex flex-col sm:flex-row gap-4 justify-center" style={{ animationDelay: "0.5s", opacity: 0, animationFillMode: "forwards" }}>
            <Button variant="hero" size="lg" asChild className="text-base px-10 h-14 text-lg rounded-2xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 hover:scale-105">
              <Link to="/login">
                লগইন করুন <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-base px-10 h-14 text-lg rounded-2xl border-2 hover:bg-accent/10 hover:border-accent/40 transition-all duration-300 hover:scale-105">
              <Link to="/menu/demo">
                ডেমো দেখুন
              </Link>
            </Button>
          </div>

          {/* Scroll hint */}
          <div className="mt-16 animate-fade-up" style={{ animationDelay: "0.7s", opacity: 0, animationFillMode: "forwards" }}>
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 mx-auto flex items-start justify-center p-1.5">
              <div className="w-1.5 h-3 rounded-full bg-muted-foreground/40 animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16 animate-fade-up">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              কিভাবে <span className="text-gradient">কাজ করে</span>?
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">তিনটি সহজ ধাপে আপনার রেস্টুরেন্ট ডিজিটাল হয়ে যাক</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Smartphone,
                emoji: "📱",
                title: "QR স্ক্যান করুন",
                desc: "টেবিলের QR কোড স্ক্যান করে সাথে সাথে মেনু দেখুন। অ্যাপ ডাউনলোডের দরকার নেই!",
                color: "bg-primary/10 text-primary border-primary/20",
                shadowColor: "shadow-primary/20",
                step: "০১",
              },
              {
                icon: ChefHat,
                emoji: "🍽️",
                title: "অর্ডার দিন",
                desc: "পছন্দের খাবার বেছে নিন এবং এক ক্লিকে অর্ডার করুন। প্রতিটি সিটের জন্য আলাদা অর্ডার!",
                color: "bg-accent/10 text-accent border-accent/20",
                shadowColor: "shadow-accent/20",
                step: "০২",
              },
              {
                icon: Zap,
                emoji: "⚡",
                title: "রিয়েলটাইম আপডেট",
                desc: "রান্নাঘর সাথে সাথে অর্ডার পায়। আপনি রিয়েলটাইমে স্ট্যাটাস দেখতে পারেন!",
                color: "bg-success/10 text-success border-success/20",
                shadowColor: "shadow-success/20",
                step: "০৩",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="animate-fade-up group relative bg-card rounded-2xl border border-border p-8 text-center transition-all duration-500 hover:shadow-2xl hover:-translate-y-2"
                style={{ animationDelay: `${0.15 * i + 0.2}s`, opacity: 0, animationFillMode: "forwards" }}
              >
                {/* Step number */}
                <div className="absolute -top-4 -right-2 w-10 h-10 rounded-full gradient-sunset text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/30 font-display">
                  {feature.step}
                </div>

                <div className={`w-20 h-20 rounded-2xl ${feature.color} border flex items-center justify-center mx-auto mb-6 transition-transform duration-300 group-hover:scale-110`}>
                  <span className="text-4xl">{feature.emoji}</span>
                </div>
                <h3 className="font-display font-bold text-foreground text-xl mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm font-body leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-3xl gradient-warm p-12 md:p-16 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/10 blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-accent/15 blur-[60px]" />

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
              {[
                { value: "৫০০+", label: "রেস্টুরেন্ট", emoji: "🏪" },
                { value: "১০,০০০+", label: "সফল অর্ডার", emoji: "📦" },
                { value: "৯৮%", label: "সন্তুষ্ট গ্রাহক", emoji: "⭐" },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="animate-fade-up"
                  style={{ animationDelay: `${0.15 * i}s`, opacity: 0, animationFillMode: "forwards" }}
                >
                  <span className="text-3xl mb-2 block">{stat.emoji}</span>
                  <div className="text-4xl md:text-5xl font-display font-bold text-white mb-2">{stat.value}</div>
                  <div className="text-white/60 text-sm font-body">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 relative z-10 bg-secondary/20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16 animate-fade-up">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              সাশ্রয়ী <span className="text-gradient-sunset">মূল্য পরিকল্পনা</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">আপনার রেস্টুরেন্টের আকার অনুযায়ী প্ল্যান বেছে নিন</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {[
              {
                name: "বেসিক",
                price: "৪৯৯",
                period: "/মাস",
                desc: "ছোট রেস্টুরেন্টের জন্য পারফেক্ট",
                features: ["৫০টি মেনু আইটেম", "৫টি টেবিল", "৩ জন স্টাফ", "QR কোড অর্ডারিং", "রিয়েলটাইম নোটিফিকেশন"],
                highlight: false,
                badge: null,
                borderClass: "border-border",
              },
              {
                name: "প্রিমিয়াম",
                price: "৯৯৯",
                period: "/মাস",
                desc: "বড় রেস্টুরেন্টের জন্য সেরা চয়েস",
                features: ["২০০টি মেনু আইটেম", "২০টি টেবিল", "১৫ জন স্টাফ", "সব বেসিক ফিচার", "অ্যানালিটিক্স ড্যাশবোর্ড", "প্রায়োরিটি সাপোর্ট"],
                highlight: true,
                badge: "জনপ্রিয়",
                borderClass: "border-primary/50",
              },
              {
                name: "এন্টারপ্রাইজ",
                price: "১,৯৯৯",
                period: "/মাস",
                desc: "চেইন রেস্টুরেন্ট ও বড় প্রতিষ্ঠানের জন্য",
                features: ["আনলিমিটেড মেনু আইটেম", "আনলিমিটেড টেবিল", "আনলিমিটেড স্টাফ", "সব প্রিমিয়াম ফিচার", "মাল্টি-ব্রাঞ্চ সাপোর্ট", "ডেডিকেটেড সাপোর্ট"],
                highlight: false,
                badge: null,
                borderClass: "border-border",
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`animate-fade-up relative bg-card rounded-2xl border-2 ${plan.borderClass} p-8 flex flex-col transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${plan.highlight ? "shadow-xl shadow-primary/15" : ""}`}
                style={{ animationDelay: `${0.15 * i + 0.1}s`, opacity: 0, animationFillMode: "forwards" }}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gradient-sunset text-white text-xs font-bold shadow-lg shadow-primary/30">
                    🔥 {plan.badge}
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="font-display font-bold text-foreground text-xl mb-1">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{plan.desc}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-sm text-muted-foreground">৳</span>
                    <span className={`text-4xl font-display font-bold ${plan.highlight ? "text-gradient-sunset" : "text-foreground"}`}>{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-6 mb-8 flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs flex-shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  variant={plan.highlight ? "hero" : "outline"}
                  size="lg"
                  asChild
                  className={`w-full rounded-xl ${plan.highlight ? "shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30" : "hover:bg-accent/10"} transition-all duration-300`}
                >
                  <Link to="/login">শুরু করুন</Link>
                </Button>
              </div>
            ))}
          </div>

          <p className="text-center text-muted-foreground text-sm mt-8 animate-fade-up" style={{ animationDelay: "0.6s", opacity: 0, animationFillMode: "forwards" }}>
            সব প্ল্যানে ৭ দিনের ফ্রি ট্রায়াল অন্তর্ভুক্ত। কোনো ক্রেডিট কার্ড লাগবে না। 🎉
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative z-10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="animate-fade-up">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              আজই শুরু করুন — <span className="text-gradient-sunset">বিনামূল্যে!</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              আপনার রেস্টুরেন্টকে ডিজিটাল করুন। ফ্রি ট্রায়ালে সব ফিচার ব্যবহার করুন।
            </p>
            <Button variant="hero" size="lg" asChild className="text-lg px-12 h-14 rounded-2xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 hover:scale-105">
              <Link to="/login">
                ফ্রি ট্রায়াল শুরু করুন <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 relative z-10 bg-card/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl gradient-sunset flex items-center justify-center shadow-md">
              <UtensilsCrossed className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-foreground text-lg">Tasty QR Spot</span>
          </div>
          <p className="text-sm text-muted-foreground">Tasty QR Spot © 2025 — সকল অধিকার সংরক্ষিত</p>
        </div>
      </footer>

      {/* Global animation keyframes */}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.12;
          }
          90% {
            opacity: 0.12;
          }
          100% {
            transform: translateY(-110vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default Index;
