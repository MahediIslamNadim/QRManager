import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  UtensilsCrossed, ArrowRight, Smartphone, ChefHat,
  Zap, BarChart3, Users, Store, QrCode, Star
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

const floatingEmojis = ["🍛","🍕","🍜","🥘","🍱","🥗","🍔","🍣","🧁","🍝","🌮","🥩"];

interface FloatingEmoji {
  id: number; emoji: string; left: number;
  delay: number; duration: number; size: number;
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.12 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

const RevealDiv = ({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) => {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s ${delay}s cubic-bezier(.22,1,.36,1), transform 0.7s ${delay}s cubic-bezier(.22,1,.36,1)`,
      }}>
      {children}
    </div>
  );
};

const Index = () => {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const generated: FloatingEmoji[] = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      emoji: floatingEmojis[i % floatingEmojis.length],
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 14 + Math.random() * 10,
      size: 18 + Math.random() * 20,
    }));
    setEmojis(generated);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-hidden">

      {/* Floating emojis */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {emojis.map((e) => (
          <span key={e.id} className="absolute opacity-[0.1] select-none"
            style={{ left:`${e.left}%`, bottom:"-60px", fontSize:`${e.size}px`,
              animation:`floatUp ${e.duration}s ${e.delay}s linear infinite` }}>
            {e.emoji}
          </span>
        ))}
      </div>

      {/* NAVBAR */}
      <nav className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-card/80 backdrop-blur-2xl border-b border-border/60 shadow-lg shadow-black/5"
                 : "bg-transparent border-b border-transparent"}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-sunset flex items-center justify-center shadow-lg shadow-primary/40 relative">
              <UtensilsCrossed className="w-5 h-5 text-white" />
              <div className="absolute inset-0 rounded-xl gradient-sunset opacity-60 blur-md -z-10" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-foreground text-lg tracking-tight">Tasty QR Spot</span>
              <span className="text-[8px] tracking-[3px] text-muted-foreground/50 font-mono uppercase">by NexCore Technologies</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[["ফিচার","#features"],["প্রাইসিং","#pricing"],["ডেমো","#demo"]].map(([label,href],i) => (
              <a key={i} href={href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">{label}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex text-sm">
              <Link to="/menu/demo">ডেমো দেখুন</Link>
            </Button>
            <Button variant="hero" size="sm" asChild className="shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow">
              <Link to="/login">লগইন <ArrowRight className="w-3.5 h-3.5" /></Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-[92vh] flex items-center justify-center pt-8">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-br from-primary/6 via-transparent to-accent/4" />
          <div className="absolute top-20 left-[5%] w-[600px] h-[600px] rounded-full bg-primary/8 blur-[140px] animate-pulse" style={{animationDuration:"6s"}} />
          <div className="absolute bottom-0 right-[5%] w-[500px] h-[500px] rounded-full bg-accent/6 blur-[120px] animate-pulse" style={{animationDuration:"8s",animationDelay:"2s"}} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-warning/4 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.025]"
            style={{backgroundImage:"radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",backgroundSize:"28px 28px"}} />
        </div>

        <div className="max-w-5xl mx-auto px-6 py-16 relative z-10 text-center">
          <div className="animate-fade-up" style={{animationDelay:"0.1s",opacity:0,animationFillMode:"forwards"}}>
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-sm font-medium mb-8 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-foreground/80">বাংলাদেশের স্মার্ট রেস্টুরেন্ট সলিউশন</span>
              <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">NEW</span>
            </div>
          </div>

          <div className="animate-fade-up" style={{animationDelay:"0s",opacity:0,animationFillMode:"forwards"}}>
            <div className="relative inline-flex mb-8">
              <div className="w-28 h-28 rounded-[28px] gradient-sunset flex items-center justify-center shadow-2xl relative z-10"
                style={{boxShadow:"0 0 80px hsl(38 92% 50% / 0.35), 0 0 160px hsl(345 65% 35% / 0.15), 0 24px 48px rgba(0,0,0,0.2)"}}>
                <UtensilsCrossed className="w-14 h-14 text-white drop-shadow-lg" />
              </div>
              <div className="absolute inset-0 rounded-[28px] gradient-sunset opacity-30 blur-3xl animate-pulse" style={{animationDuration:"3s"}} />
            </div>
          </div>

          <div className="animate-fade-up" style={{animationDelay:"0.2s",opacity:0,animationFillMode:"forwards"}}>
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-display font-bold text-foreground leading-[1.05] mb-6 tracking-tight">
              স্মার্ট রেস্টুরেন্ট<br />
              <span className="text-gradient-sunset relative inline-block">
                অর্ডারিং
                <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 300 8" fill="none">
                  <path d="M0 6 Q75 0 150 4 Q225 8 300 2" stroke="hsl(38,92%,50%)" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5"/>
                </svg>
              </span>{" "}সিস্টেম
            </h1>
          </div>

          <div className="animate-fade-up" style={{animationDelay:"0.35s",opacity:0,animationFillMode:"forwards"}}>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              QR কোড স্ক্যান করুন, মেনু দেখুন, অর্ডার দিন —{" "}
              <span className="text-foreground font-semibold">কোনো অ্যাপ ছাড়াই!</span>{" "}
              রান্নাঘর সাথে সাথে রিয়েলটাইম অর্ডার পায়।
            </p>
          </div>

          <div className="animate-fade-up flex flex-col sm:flex-row gap-4 justify-center mb-10"
            style={{animationDelay:"0.5s",opacity:0,animationFillMode:"forwards"}}>
            <Button variant="hero" size="lg" asChild
              className="text-base px-10 h-14 rounded-2xl shadow-xl shadow-primary/35 hover:shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-[1.03] group">
              <Link to="/login">
                শুরু করুন — বিনামূল্যে
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild
              className="text-base px-10 h-14 rounded-2xl border-2 hover:bg-accent/8 hover:border-accent/40 transition-all duration-300 hover:scale-[1.03]">
              <Link to="/menu/demo">🎮 লাইভ ডেমো দেখুন</Link>
            </Button>
          </div>

          <div className="animate-fade-up flex items-center justify-center gap-6 flex-wrap"
            style={{animationDelay:"0.65s",opacity:0,animationFillMode:"forwards"}}>
            {["৭ দিন ফ্রি ট্রায়াল","ক্রেডিট কার্ড লাগবে না","যেকোনো সময় বাতিল করুন"].map((t,i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="text-success font-bold">✓</span>{t}
              </div>
            ))}
          </div>

          <div className="mt-16 animate-fade-up" style={{animationDelay:"0.8s",opacity:0,animationFillMode:"forwards"}}>
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/20 mx-auto flex items-start justify-center p-1.5">
              <div className="w-1.5 h-3 rounded-full bg-muted-foreground/30 animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="features" className="py-28 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <RevealDiv className="text-center mb-20">
            <p className="text-xs font-mono tracking-[4px] text-primary uppercase mb-3">// কিভাবে কাজ করে</p>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4 tracking-tight">
              তিনটি সহজ <span className="text-gradient">ধাপ</span>
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">মিনিটের মধ্যে আপনার রেস্টুরেন্ট ডিজিটাল হয়ে যাক</p>
          </RevealDiv>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            {[
              {emoji:"📱",title:"QR স্ক্যান করুন",desc:"টেবিলের QR কোড স্ক্যান করে সাথে সাথে মেনু দেখুন। কোনো অ্যাপ লাগবে না!",color:"from-orange-500/20 to-amber-500/10",step:"০১",delay:0},
              {emoji:"🍽️",title:"অর্ডার দিন",desc:"পছন্দের খাবার বেছে নিন এবং এক ক্লিকে অর্ডার করুন। প্রতিটি সিটে আলাদা অর্ডার!",color:"from-rose-500/20 to-pink-500/10",step:"০২",delay:0.12},
              {emoji:"⚡",title:"রিয়েলটাইম আপডেট",desc:"রান্নাঘর সাথে সাথে অর্ডার পায়। রিয়েলটাইমে স্ট্যাটাস ট্র্যাক করুন!",color:"from-emerald-500/20 to-teal-500/10",step:"০৩",delay:0.24},
            ].map((f,i) => (
              <RevealDiv key={i} delay={f.delay}
                className="group relative bg-card rounded-3xl border border-border p-8 text-center hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl`} />
                <div className="absolute top-5 right-5 w-9 h-9 rounded-full gradient-sunset text-white text-xs font-bold flex items-center justify-center shadow-lg font-mono">{f.step}</div>
                <div className="relative z-10">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-background to-secondary border border-border flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:shadow-lg transition-all duration-400">
                    <span className="text-4xl">{f.emoji}</span>
                  </div>
                  <h3 className="font-display font-bold text-foreground text-xl mb-3">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </RevealDiv>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-24 relative z-10 bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <RevealDiv className="text-center mb-16">
            <p className="text-xs font-mono tracking-[4px] text-primary uppercase mb-3">// সুবিধাসমূহ</p>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight">
              সব কিছু <span className="text-gradient-sunset">এক জায়গায়</span>
            </h2>
          </RevealDiv>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {emoji:"📱",title:"QR ডিজিটাল মেনু",desc:"টেবিলে QR কোড রাখুন — স্ক্যান করলেই মেনু।",color:"text-orange-500 bg-orange-500/10"},
              {emoji:"⚡",title:"রিয়েলটাইম অর্ডার",desc:"অর্ডার হওয়ার সাথে সাথে কিচেনে চলে যায়।",color:"text-yellow-500 bg-yellow-500/10"},
              {emoji:"🪑",title:"টেবিল ম্যানেজমেন্ট",desc:"কোন টেবিল ফাঁকা, কোনটায় অর্ডার — সব এক স্ক্রিনে।",color:"text-blue-500 bg-blue-500/10"},
              {emoji:"👥",title:"মাল্টি-রোল স্টাফ",desc:"Super Admin, Admin, Waiter — সবার আলাদা dashboard।",color:"text-purple-500 bg-purple-500/10"},
              {emoji:"📊",title:"অ্যানালিটিক্স",desc:"বেস্ট সেলার, রেভিনিউ, পিক আওয়ার — সব data।",color:"text-green-500 bg-green-500/10"},
              {emoji:"🏢",title:"মাল্টি-রেস্টুরেন্ট",desc:"একাধিক ব্রাঞ্চ একটি Super Admin account থেকে।",color:"text-rose-500 bg-rose-500/10"},
            ].map((f,i) => (
              <RevealDiv key={i} delay={i*0.07}
                className="group bg-card rounded-2xl border border-border p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-400 cursor-default">
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-2xl">{f.emoji}</span>
                </div>
                <h3 className="font-display font-bold text-foreground text-base mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </RevealDiv>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-28 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <RevealDiv className="text-center mb-16">
            <p className="text-xs font-mono tracking-[4px] text-primary uppercase mb-3">// মূল্য পরিকল্পনা</p>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4 tracking-tight">
              সাশ্রয়ী <span className="text-gradient-sunset">প্রাইসিং</span>
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">আপনার রেস্টুরেন্টের আকার অনুযায়ী প্ল্যান বেছে নিন</p>
          </RevealDiv>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {[
              {name:"বেসিক",price:"৩৯৯",period:"/মাস",desc:"ছোট রেস্টুরেন্টের জন্য পারফেক্ট",
               features:["৫০টি মেনু আইটেম","৫টি টেবিল","৩ জন স্টাফ","QR অর্ডারিং","রিয়েলটাইম নোটিফিকেশন"],
               highlight:false,badge:null,delay:0},
              {name:"প্রিমিয়াম",price:"৬৯৯",period:"/মাস",desc:"বড় রেস্টুরেন্টের জন্য সেরা চয়েস",
               features:["২০০টি মেনু আইটেম","২০টি টেবিল","১৫ জন স্টাফ","সব বেসিক ফিচার","অ্যানালিটিক্স","প্রায়োরিটি সাপোর্ট"],
               highlight:true,badge:"🔥 জনপ্রিয়",delay:0.1},
              {name:"এন্টারপ্রাইজ",price:"১,১৯৯",period:"/মাস",desc:"চেইন রেস্টুরেন্ট ও বড় প্রতিষ্ঠানের জন্য",
               features:["আনলিমিটেড মেনু","আনলিমিটেড টেবিল","আনলিমিটেড স্টাফ","সব প্রিমিয়াম ফিচার","মাল্টি-ব্রাঞ্চ","ডেডিকেটেড সাপোর্ট"],
               highlight:false,badge:null,delay:0.2},
            ].map((plan,i) => (
              <RevealDiv key={i} delay={plan.delay}
                className={`relative bg-card rounded-3xl border-2 p-8 flex flex-col transition-all duration-400 hover:-translate-y-2 hover:shadow-2xl
                  ${plan.highlight ? "border-primary/60 shadow-xl shadow-primary/15 scale-[1.02]" : "border-border hover:border-primary/30"}`}>
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full gradient-sunset text-white text-xs font-bold shadow-lg">{plan.badge}</div>
                )}
                {plan.highlight && <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/5 to-accent/5 pointer-events-none" />}
                <div className="text-center mb-6 relative z-10">
                  <h3 className="font-display font-bold text-foreground text-xl mb-1">{plan.name}</h3>
                  <p className="text-muted-foreground text-xs mb-5">{plan.desc}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-lg font-bold text-muted-foreground">৳</span>
                    <span className={`text-5xl font-display font-bold tracking-tight ${plan.highlight ? "text-gradient-sunset" : "text-foreground"}`}>{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                </div>
                <div className="border-t border-border/50 pt-6 mb-8 flex-1 relative z-10">
                  <ul className="space-y-3">
                    {plan.features.map((f,fi) => (
                      <li key={fi} className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs flex-shrink-0 font-bold">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant={plan.highlight ? "hero" : "outline"} size="lg" asChild
                  className={`w-full rounded-xl relative z-10 ${plan.highlight ? "shadow-lg shadow-primary/25" : ""} transition-all duration-300`}>
                  <Link to="/login">শুরু করুন →</Link>
                </Button>
              </RevealDiv>
            ))}
          </div>
          <RevealDiv delay={0.3} className="text-center mt-8">
            <p className="text-muted-foreground text-sm">✨ সব প্ল্যানে <strong>৭ দিনের ফ্রি ট্রায়াল</strong> — কোনো ক্রেডিট কার্ড লাগবে না</p>
          </RevealDiv>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative z-10 overflow-hidden">
        <div className="max-w-4xl mx-auto px-6">
          <RevealDiv>
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 gradient-warm opacity-90" />
              <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-primary/20 blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full bg-accent/20 blur-[60px]" />
              <div className="relative z-10 py-16 px-8 md:px-16 text-center">
                <div className="flex justify-center gap-1 mb-4">
                  {[...Array(5)].map((_,i) => <Star key={i} className="w-5 h-5 fill-yellow-300 text-yellow-300" />)}
                </div>
                <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4 leading-tight">
                  আজই আপনার রেস্টুরেন্ট<br />ডিজিটাল করুন!
                </h2>
                <p className="text-white/70 mb-8 max-w-md mx-auto text-base">ফ্রি ট্রায়ালে সব ফিচার ব্যবহার করুন। কোনো ঝামেলা নেই।</p>
                <Button size="lg" asChild
                  className="bg-white text-foreground hover:bg-white/90 text-base px-12 h-14 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                  <Link to="/login">ফ্রি ট্রায়াল শুরু করুন <ArrowRight className="w-5 h-5" /></Link>
                </Button>
              </div>
            </div>
          </RevealDiv>
        </div>
      </section>

      {/* NCT BAR */}
      <div className="bg-foreground/96 py-4 px-6 flex items-center justify-center gap-3 flex-wrap">
        <span className="text-[9px] tracking-[3px] text-white/25 font-mono uppercase">A Product of</span>
        <a href="https://nexcoreltd.com" target="_blank" rel="noopener noreferrer"
          className="text-[9px] tracking-[3px] text-cyan-400/60 hover:text-cyan-400 font-mono uppercase transition-colors duration-200">
          ⬡ NexCore Technologies Ltd.
        </a>
        <span className="text-[9px] tracking-[3px] text-white/25 font-mono uppercase">· Bangladesh 🇧🇩</span>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-border/40 py-12 relative z-10 bg-card/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl gradient-sunset flex items-center justify-center shadow-md">
              <UtensilsCrossed className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="font-display font-bold text-foreground text-lg">Tasty QR Spot</span>
              <span className="text-[8px] tracking-[3px] text-muted-foreground/40 font-mono uppercase">by NexCore Technologies</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mb-6 flex-wrap">
            {[["ফিচার","#features"],["প্রাইসিং","#pricing"],["ডেমো মেনু","/menu/demo"],["লগইন","/login"]].map(([l,h],i) => (
              <a key={i} href={h} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">{l}</a>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/60">
            © 2025 Tasty QR Spot — একটি{" "}
            <a href="https://nexcoreltd.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">NexCore Technologies Ltd.</a>{" "}
            পণ্য · সকল অধিকার সংরক্ষিত
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
          10%  { opacity: 0.1; }
          90%  { opacity: 0.1; }
          100% { transform: translateY(-115vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Index;
