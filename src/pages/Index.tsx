import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { UtensilsCrossed, QrCode, ShoppingCart, BarChart3, ArrowRight, Shield, Zap, Globe } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground text-xl">Restaurant QR</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/menu/demo">ডেমো মেনু</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/login">লগইন</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 relative z-10">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              আধুনিক রেস্টুরেন্ট ম্যানেজমেন্ট
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground leading-tight mb-6">
              QR কোড দিয়ে{" "}
              <span className="text-gradient">রেস্টুরেন্ট</span>{" "}
              অর্ডারিং সিস্টেম
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto font-body">
              কাস্টমাররা QR কোড স্ক্যান করে মেনু দেখবে এবং অর্ডার দেবে। সম্পূর্ণ ডিজিটাল, দ্রুত এবং সুবিধাজনক।
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg" asChild className="text-base px-8">
                <Link to="/login">
                  শুরু করুন <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="text-base px-8">
                <Link to="/menu/demo">ডেমো দেখুন</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-display font-bold text-foreground text-center mb-12">
            কেন <span className="text-gradient">Restaurant QR</span>?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: QrCode, title: "QR কোড অর্ডারিং", desc: "প্রতিটি টেবিলে QR কোড। কাস্টমার স্ক্যান করে সরাসরি অর্ডার দেয়।" },
              { icon: ShoppingCart, title: "রিয়েল-টাইম অর্ডার", desc: "অর্ডার তাৎক্ষণিকভাবে রান্নাঘরে যায়। ওয়েটার রিয়েল-টাইমে আপডেট পায়।" },
              { icon: BarChart3, title: "বিশ্লেষণ ড্যাশবোর্ড", desc: "বিক্রয়, জনপ্রিয় আইটেম, এবং কাস্টমার ইনসাইটস এক জায়গায়।" },
              { icon: Shield, title: "নিরাপদ ও নির্ভরযোগ্য", desc: "ডাটা এনক্রিপশন এবং নিরাপদ পেমেন্ট প্রসেসিং।" },
              { icon: Zap, title: "দ্রুত সেটআপ", desc: "কয়েক মিনিটেই আপনার রেস্টুরেন্ট সেটআপ করুন। কোনো টেকনিক্যাল জ্ঞান লাগবে না।" },
              { icon: Globe, title: "মাল্টি-রেস্টুরেন্ট", desc: "একাধিক রেস্টুরেন্ট ম্যানেজ করুন একটি প্ল্যাটফর্ম থেকে।" },
            ].map((feature, i) => (
              <div key={i} className="stat-card text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
                  <feature.icon className="w-7 h-7 text-accent-foreground" />
                </div>
                <h3 className="font-display font-semibold text-foreground text-lg mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm font-body">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">Restaurant QR</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Restaurant QR SaaS. সর্বস্বত্ব সংরক্ষিত।</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
