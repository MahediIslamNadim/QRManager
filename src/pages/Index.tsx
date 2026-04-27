import { UtensilsCrossed, ArrowRight, Star, Menu, X } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { APP_NAME, COMPANY_NAME, COMPANY_URL, FREE_TRIAL_DAYS } from "@/constants/app";
import { TIERS } from "@/constants/tiers";

const floatingEmojis = ["🍛","🍕","🍜","🥘","🍱","🥗","🍔","🍣","🧁","🍝","🌮","🥩"];
interface FE { id:number; emoji:string; left:number; delay:number; duration:number; size:number; }

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0px)" : "translateY(48px)",
      transition: `opacity 0.9s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.9s ${delay}s cubic-bezier(0.16,1,0.3,1)`,
    }}>{children}</div>
  );
};

export default function Index() {
  const [emojis, setEmojis] = useState<FE[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly"|"yearly">("monthly");

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    setEmojis(Array.from({ length: 10 }, (_, i) => ({
      id: i, emoji: floatingEmojis[i % floatingEmojis.length],
      left: Math.random() * 100, delay: Math.random() * 14,
      duration: 18 + Math.random() * 12, size: 14 + Math.random() * 16,
    })));
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("scroll", fn);
    };
  }, []);

  const gold = "linear-gradient(135deg, #c9a84c, #f5d780, #b8860b)";
  const goldText = { background: gold, WebkitBackgroundClip: "text" as const, WebkitTextFillColor: "transparent" as const };
  const navLinks: [string, string][] = [["ফিচার","#features"],["প্রাইসিং","#pricing"],["ডেমো","/menu/demo"],["যোগাযোগ","#contact"]];

  const plans = [
    {
      key: "medium_smart" as const,
      icon: "⚡",
      name: TIERS.medium_smart.name_bn,
      desc: "মাঝারি রেস্টুরেন্টের জন্য সেরা চয়েস",
      price_monthly: TIERS.medium_smart.price_monthly,
      price_yearly: TIERS.medium_smart.price_yearly,
      hot: true,
      color: "#3b82f6",
      features: ["QR কোড অর্ডারিং","মেনু ম্যানেজমেন্ট","২০টি টেবিল ম্যানেজমেন্ট","রিয়েলটাইম অর্ডার + কিচেন ডিসপ্লে","অ্যানালিটিক্স + সেলস রিপোর্ট","WhatsApp + ইমেইল নোটিফিকেশন","bKash/Nagad পেমেন্ট","৫ জন স্টাফ"],
    },
    {
      key: "high_smart" as const,
      icon: "👑",
      name: TIERS.high_smart.name_bn,
      desc: "বড় রেস্টুরেন্ট বা মাল্টি-ব্র্যান্চের জন্য",
      price_monthly: TIERS.high_smart.price_monthly,
      price_yearly: TIERS.high_smart.price_yearly,
      hot: false,
      color: "#a855f7",
      features: ["মিডিয়াম স্মার্টের সব ফিচার","আনলিমিটেড টেবিল ও স্টাফ","মাল্টি-লোকেশন সাপোর্ট","AI রেকমেন্ডেশন (Gemini)","প্রেডিক্টিভ অ্যানালিটিক্স","কাস্টম ব্র্যান্ডিং (লোগো + রং)","প্রায়োরিটি সাপোর্ট ২৪/৭","ডেডিকেটেড ম্যানেজার"],
    },
  ];

  return (
    <div style={{ fontFamily:"'Cormorant Garamond', 'DM Sans', serif", backgroundColor:"#0a0a0a", color:"#e8dcc8", minHeight:"100vh" }}>

      {/* Floating emojis */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        {emojis.map(e => (
          <span key={e.id} style={{ position:"absolute", left:`${e.left}%`, bottom:"-50px", fontSize:`${e.size}px`, opacity:0.07, userSelect:"none", animation:`floatUp ${e.duration}s ${e.delay}s linear infinite` }}>{e.emoji}</span>
        ))}
      </div>

      {/* ─── NAVBAR ─── */}
      <nav style={{ position:"sticky", top:0, zIndex:100, backgroundColor: scrolled ? "rgba(10,10,10,0.95)" : "transparent", backdropFilter: scrolled ? "blur(24px)" : "none", borderBottom: scrolled ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent", transition:"all 0.5s ease" }}>
        <div style={{ maxWidth:1140, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)", height:64, display:"flex", alignItems:"center", justifyContent:"space-between" }}>

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:gold, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 20px rgba(201,168,76,0.4)", flexShrink:0 }}>
              <UtensilsCrossed size={19} color="#0a0a0a" />
            </div>
            <div>
              <div style={{ fontFamily:"'Cormorant Garamond', serif", fontWeight:700, fontSize:"clamp(16px,4vw,20px)", color:"#FFFFFF", letterSpacing:"0.02em" }}>{APP_NAME}</div>
              <div style={{ fontSize:7, letterSpacing:"0.25em", color:"rgba(201,168,76,0.7)", textTransform:"uppercase", fontFamily:"monospace" }}>by {COMPANY_NAME.replace(" Ltd.", "")}</div>
            </div>
          </div>

          {/* Desktop nav — hidden on mobile */}
          {!isMobile && (
            <div style={{ display:"flex", gap:36, alignItems:"center" }}>
              {navLinks.map(([l,h]) => (
                <a key={l} href={h} style={{ fontSize:14, fontWeight:500, color:"rgba(255,255,255,0.75)", textDecoration:"none", letterSpacing:"0.05em", transition:"color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.color="#f5d780"}
                  onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.75)"}>{l}</a>
              ))}
            </div>
          )}

          {/* Desktop CTAs — hidden on mobile */}
          {!isMobile && (
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <a href="/menu/demo" style={{ padding:"8px 18px", borderRadius:8, fontSize:13, fontWeight:600, color:"#f5d780", textDecoration:"none", border:"1px solid rgba(201,168,76,0.45)", transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(201,168,76,0.9)"; e.currentTarget.style.backgroundColor="rgba(201,168,76,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(201,168,76,0.45)"; e.currentTarget.style.backgroundColor="transparent"; }}>
                ডেমো
              </a>
              <a href="/login" style={{ padding:"8px 20px", borderRadius:8, fontSize:13, fontWeight:700, color:"#0a0a0a", textDecoration:"none", background:gold, boxShadow:"0 4px 20px rgba(201,168,76,0.35)", display:"flex", alignItems:"center", gap:6, transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow="0 6px 28px rgba(201,168,76,0.55)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow="0 4px 20px rgba(201,168,76,0.35)"; e.currentTarget.style.transform="translateY(0)"; }}>
                লগইন <ArrowRight size={13} />
              </a>
            </div>
          )}

          {/* Mobile: login + hamburger — hidden on desktop */}
          {isMobile && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <a href="/login" style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:700, color:"#0a0a0a", textDecoration:"none", background:gold }}>লগইন</a>
              <button onClick={() => setMenuOpen(!menuOpen)} style={{ width:36, height:36, borderRadius:8, background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.25)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                {menuOpen ? <X size={16} color="#f5d780" /> : <Menu size={16} color="#f5d780" />}
              </button>
            </div>
          )}
        </div>

        {/* Mobile dropdown */}
        {isMobile && menuOpen && (
          <div style={{ backgroundColor:"rgba(10,10,10,0.98)", borderTop:"1px solid rgba(201,168,76,0.12)", padding:"8px 20px 16px" }}>
            {navLinks.map(([l,h]) => (
              <a key={l} href={h} onClick={() => setMenuOpen(false)} style={{ display:"block", padding:"13px 0", borderBottom:"1px solid rgba(201,168,76,0.07)", fontSize:15, color:"rgba(255,255,255,0.7)", textDecoration:"none", fontFamily:"'DM Sans', sans-serif" }}>{l}</a>
            ))}
            <a href="/menu/demo" onClick={() => setMenuOpen(false)} style={{ display:"block", marginTop:14, padding:"12px", borderRadius:8, textAlign:"center", fontSize:14, fontWeight:600, color:"#f5d780", textDecoration:"none", border:"1px solid rgba(201,168,76,0.35)" }}>
              🎮 লাইভ ডেমো দেখুন
            </a>
          </div>
        )}
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ position:"relative", minHeight:"92vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0 }}>
          <div style={{ position:"absolute", top:"10%", left:"50%", transform:"translateX(-50%)", width:"min(800px,150vw)", height:"min(800px,150vw)", borderRadius:"50%", background:"radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%)" }} />
          <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(201,168,76,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.05) 1px, transparent 1px)", backgroundSize:"60px 60px" }} />
          <div style={{ position:"absolute", top:"35%", left:0, right:0, height:"1px", background:"linear-gradient(90deg, transparent, rgba(201,168,76,0.12), transparent)" }} />
        </div>

        <div style={{ maxWidth:900, margin:"0 auto", padding:"clamp(48px,8vw,80px) clamp(16px,5vw,32px)", position:"relative", zIndex:1, textAlign:"center" }}>

          {/* Badge */}
          <div style={{ animation:"fadeDown 0.8s 0.1s ease both", marginBottom:"clamp(20px,4vw,40px)" }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px clamp(14px,3vw,24px)", borderRadius:100, border:"1px solid rgba(201,168,76,0.45)", background:"linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.05))", fontSize:"clamp(9px,2.2vw,12px)", fontWeight:600, color:"#f5d780", letterSpacing:"0.06em" }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:gold, display:"inline-block", boxShadow:"0 0 8px rgba(201,168,76,0.9)", animation:"glow 2s infinite", flexShrink:0 }} />
              {isMobile ? "RESTAURANT SOLUTION" : "BANGLADESH'S PREMIER RESTAURANT SOLUTION"}
              <span style={{ padding:"2px 8px", borderRadius:20, fontSize:9, fontWeight:700, background:"rgba(201,168,76,0.2)", color:"#f5d780", letterSpacing:"0.1em", flexShrink:0 }}>NEW</span>
            </div>
          </div>

          {/* App Icon */}
          <div style={{ marginBottom:"clamp(20px,4vw,36px)", animation:"fadeDown 0.8s 0s ease both", display:"inline-block", position:"relative" }}>
            <div style={{ width:"clamp(80px,15vw,120px)", height:"clamp(80px,15vw,120px)", borderRadius:"clamp(20px,4vw,32px)", background:gold, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 0 1px rgba(201,168,76,0.4), 0 0 60px rgba(201,168,76,0.3), 0 24px 48px rgba(0,0,0,0.5)", position:"relative", zIndex:1 }}>
              <UtensilsCrossed size={40} color="#0a0a0a" />
            </div>
            <div style={{ position:"absolute", inset:-12, borderRadius:44, background:gold, opacity:0.15, filter:"blur(24px)", animation:"pulse 4s infinite" }} />
          </div>

          {/* Headline */}
          <div style={{ animation:"fadeUp 0.8s 0.25s ease both" }}>
            <h1 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(38px,9vw,108px)", fontWeight:700, lineHeight:1.05, color:"#FFFFFF", marginBottom:8, letterSpacing:"-0.02em" }}>স্মার্ট রেস্টুরেন্ট</h1>
            <h1 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(38px,9vw,108px)", fontWeight:700, lineHeight:1.2, marginBottom:"clamp(16px,3vw,32px)", letterSpacing:"-0.02em", padding:"8px 4px", ...goldText }}>অর্ডারিং সিস্টেম</h1>
          </div>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginBottom:"clamp(14px,3vw,28px)", animation:"fadeUp 0.8s 0.35s ease both" }}>
            <div style={{ height:"1px", width:50, background:"linear-gradient(90deg, transparent, rgba(201,168,76,0.6))" }} />
            <span style={{ color:"rgba(201,168,76,0.8)", fontSize:14 }}>✦</span>
            <div style={{ height:"1px", width:50, background:"linear-gradient(90deg, rgba(201,168,76,0.6), transparent)" }} />
          </div>

          {/* Subtext */}
          <p style={{ fontSize:"clamp(14px,3.5vw,18px)", lineHeight:1.8, color:"rgba(255,255,255,0.8)", maxWidth:520, margin:"0 auto clamp(24px,5vw,44px)", fontFamily:"'DM Sans', sans-serif", animation:"fadeUp 0.8s 0.45s ease both" }}>
            QR কোড স্ক্যান করুন, মেনু দেখুন, অর্ডার দিন —{" "}
            <span style={{ color:"#f5d780", fontWeight:700 }}>কোনো অ্যাপ ছাড়াই!</span>{" "}
            রান্নাঘর রিয়েলটাইম অর্ডার পায়।
          </p>

          {/* CTAs */}
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginBottom:"clamp(24px,5vw,40px)", animation:"fadeUp 0.8s 0.55s ease both" }}>
            <a href="/login" style={{ padding:"clamp(12px,2.5vw,16px) clamp(24px,5vw,40px)", borderRadius:10, fontSize:"clamp(13px,3vw,15px)", fontWeight:700, color:"#0a0a0a", textDecoration:"none", background:gold, boxShadow:"0 8px 32px rgba(201,168,76,0.35)", display:"flex", alignItems:"center", gap:8, fontFamily:"'DM Sans', sans-serif", transition:"all 0.3s", whiteSpace:"nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow="0 14px 44px rgba(201,168,76,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform="translateY(0) scale(1)"; e.currentTarget.style.boxShadow="0 8px 32px rgba(201,168,76,0.35)"; }}>
              শুরু করুন — বিনামূল্যে <ArrowRight size={15} />
            </a>
            <a href="/menu/demo" style={{ padding:"clamp(12px,2.5vw,16px) clamp(24px,5vw,40px)", borderRadius:10, fontSize:"clamp(13px,3vw,15px)", fontWeight:600, color:"#f5d780", textDecoration:"none", border:"1px solid rgba(201,168,76,0.45)", transition:"all 0.3s", fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(201,168,76,0.9)"; e.currentTarget.style.backgroundColor="rgba(201,168,76,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(201,168,76,0.45)"; e.currentTarget.style.backgroundColor="transparent"; }}>
              🎮 লাইভ ডেমো দেখুন
            </a>
          </div>

          {/* Trust */}
          <div style={{ display:"flex", gap:"clamp(12px,4vw,28px)", justifyContent:"center", flexWrap:"wrap", animation:"fadeUp 0.8s 0.65s ease both" }}>
            {[`✓ ${FREE_TRIAL_DAYS} দিন ফ্রি ট্রায়াল`,"✓ ক্রেডিট কার্ড লাগবে না","✓ যেকোনো সময় বাতিল"].map((t,i) => (
              <span key={i} style={{ fontSize:"clamp(10px,2.5vw,13px)", color:"rgba(245,215,128,0.75)", fontFamily:"'DM Sans', sans-serif", fontWeight:500 }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="features" style={{ padding:"clamp(56px,10vw,120px) clamp(16px,5vw,32px)", backgroundColor:"#0d0d0d" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:"clamp(36px,6vw,72px)" }}>
              <div style={{ fontSize:11, letterSpacing:"0.4em", color:"#f5d780", textTransform:"uppercase", fontFamily:"monospace", marginBottom:14, fontWeight:600 }}>✦ কিভাবে কাজ করে ✦</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(30px,5vw,60px)", fontWeight:700, color:"#FFFFFF", marginBottom:14 }}>তিনটি সহজ{" "}<span style={goldText}>ধাপ</span></h2>
              <p style={{ fontSize:"clamp(13px,3vw,16px)", color:"rgba(255,255,255,0.65)", maxWidth:380, margin:"0 auto", fontFamily:"'DM Sans', sans-serif" }}>মিনিটের মধ্যে আপনার রেস্টুরেন্ট ডিজিটাল হয়ে যাক</p>
            </div>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? 12 : 2 }}>
            {[
              { emoji:"📱", step:"01", title:"QR স্ক্যান করুন", desc:"টেবিলের QR স্ক্যান করলেই মেনু — কোনো অ্যাপ লাগবে না!" },
              { emoji:"🍽️", step:"02", title:"অর্ডার দিন", desc:"পছন্দের খাবার বেছে এক ক্লিকে অর্ডার। প্রতিটি সিটে আলাদা অর্ডার!" },
              { emoji:"⚡", step:"03", title:"রিয়েলটাইম আপডেট", desc:"রান্নাঘর সাথে সাথে অর্ডার পায়। স্ট্যাটাস রিয়েলটাইমে ট্র্যাক করুন!" },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.15}>
                <div style={{ padding:"clamp(28px,5vw,44px) clamp(20px,4vw,36px)", backgroundColor:"#141414", border:"1px solid rgba(201,168,76,0.15)", transition:"all 0.4s", position:"relative", overflow:"hidden", borderRadius: isMobile ? 12 : 4, marginBottom: isMobile ? 0 : 0 }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor="#1a1a1a"; e.currentTarget.style.borderColor="rgba(201,168,76,0.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor="#141414"; e.currentTarget.style.borderColor="rgba(201,168,76,0.15)"; }}>
                  <div style={{ position:"absolute", top:20, right:20, fontFamily:"monospace", fontSize:44, fontWeight:800, color:"rgba(201,168,76,0.1)", lineHeight:1 }}>{f.step}</div>
                  <div style={{ fontSize:40, marginBottom:20 }}>{f.emoji}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(18px,3vw,24px)", fontWeight:700, color:"#FFFFFF", marginBottom:10 }}>{f.title}</div>
                  <div style={{ fontSize:"clamp(13px,2.5vw,15px)", color:"rgba(255,255,255,0.7)", lineHeight:1.8, fontFamily:"'DM Sans', sans-serif" }}>{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section style={{ padding:"clamp(56px,10vw,120px) clamp(16px,5vw,32px)", backgroundColor:"#0a0a0a" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:"clamp(36px,6vw,72px)" }}>
              <div style={{ fontSize:11, letterSpacing:"0.4em", color:"#f5d780", textTransform:"uppercase", fontFamily:"monospace", marginBottom:14, fontWeight:600 }}>✦ সুবিধাসমূহ ✦</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(30px,5vw,60px)", fontWeight:700, color:"#FFFFFF" }}>সব কিছু <span style={goldText}>এক জায়গায়</span></h2>
            </div>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap:1 }}>
            {[
              { emoji:"📱", title:"QR ডিজিটাল মেনু", desc:"টেবিলে QR রাখুন — স্ক্যান করলেই সুন্দর মেনু।" },
              { emoji:"⚡", title:"রিয়েলটাইম অর্ডার", desc:"অর্ডার হওয়ার সাথে সাথে কিচেনে চলে যায়।" },
              { emoji:"🪑", title:"টেবিল ম্যানেজমেন্ট", desc:"কোন টেবিল ফাঁকা, কোনটায় অর্ডার — এক স্ক্রিনে।" },
              { emoji:"👥", title:"মাল্টি-রোল স্টাফ", desc:"Super Admin, Admin, Waiter — সবার আলাদা dashboard।" },
              { emoji:"📊", title:"অ্যানালিটিক্স", desc:"বেস্ট সেলার, রেভিনিউ, পিক আওয়ার — সব data।" },
              { emoji:"🏢", title:"মাল্টি-ব্রাঞ্চ", desc:"একাধিক রেস্টুরেন্ট একটি account থেকে পরিচালনা।" },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div style={{ padding:"clamp(22px,4vw,32px) clamp(18px,3vw,28px)", backgroundColor:"#111111", border:"1px solid rgba(201,168,76,0.12)", transition:"all 0.3s", cursor:"default", marginBottom: isMobile ? 2 : 0 }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor="#161616"; e.currentTarget.style.borderColor="rgba(201,168,76,0.35)"; e.currentTarget.style.transform="translateY(-3px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor="#111111"; e.currentTarget.style.borderColor="rgba(201,168,76,0.12)"; e.currentTarget.style.transform="translateY(0)"; }}>
                  <div style={{ fontSize:28, marginBottom:14 }}>{f.emoji}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(16px,2.5vw,20px)", fontWeight:700, color:"#f5d780", marginBottom:8 }}>{f.title}</div>
                  <div style={{ fontSize:"clamp(12px,2.5vw,14px)", color:"rgba(255,255,255,0.7)", lineHeight:1.75, fontFamily:"'DM Sans', sans-serif" }}>{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" style={{ padding:"clamp(56px,10vw,120px) clamp(16px,5vw,32px)", backgroundColor:"#0d0d0d" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:"clamp(28px,5vw,52px)" }}>
              <div style={{ fontSize:11, letterSpacing:"0.4em", color:"#f5d780", textTransform:"uppercase", fontFamily:"monospace", marginBottom:14, fontWeight:600 }}>✦ মূল্য পরিকল্পনা ✦</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(30px,5vw,60px)", fontWeight:700, color:"#FFFFFF", marginBottom:10 }}>সাশ্রয়ী <span style={goldText}>প্রাইসিং</span></h2>
              <p style={{ fontSize:"clamp(13px,3vw,16px)", color:"rgba(255,255,255,0.65)", fontFamily:"'DM Sans', sans-serif", marginBottom:28 }}>আপনার রেস্টুরেন্টের আকার অনুযায়ী প্ল্যান বেছে নিন</p>

              {/* Billing cycle toggle */}
              <div style={{ display:"inline-flex", alignItems:"center", gap:0, borderRadius:100, border:"1px solid rgba(201,168,76,0.3)", padding:4, background:"rgba(201,168,76,0.05)" }}>
                {(["monthly","yearly"] as const).map(cycle => (
                  <button key={cycle} onClick={() => setBillingCycle(cycle)}
                    style={{ padding:"8px 22px", borderRadius:100, fontSize:13, fontWeight:600, border:"none", cursor:"pointer", transition:"all 0.25s", fontFamily:"'DM Sans', sans-serif",
                      background: billingCycle === cycle ? gold : "transparent",
                      color: billingCycle === cycle ? "#0a0a0a" : "rgba(255,255,255,0.6)",
                    }}>
                    {cycle === "monthly" ? "মাসিক" : (
                      <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                        বার্ষিক
                        <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(34,197,94,0.2)", color:"#4ade80" }}>২০% ছাড়</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap:20, maxWidth:800, margin:"0 auto" }}>
            {plans.map((p, i) => {
              const price = billingCycle === "monthly" ? p.price_monthly : p.price_yearly;
              return (
                <Reveal key={p.key} delay={i * 0.12}>
                  <div style={{ borderRadius:20, padding:"clamp(28px,5vw,40px) clamp(20px,4vw,32px)", backgroundColor: p.hot ? "#141414" : "#111111", border: p.hot ? "1px solid rgba(201,168,76,0.5)" : "1px solid rgba(201,168,76,0.15)", boxShadow: p.hot ? "0 0 60px rgba(201,168,76,0.1), inset 0 1px 0 rgba(201,168,76,0.2)" : "none", position:"relative", display:"flex", flexDirection:"column", transition:"all 0.3s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; }}>
                    {p.hot && <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)", padding:"5px 18px", borderRadius:100, fontSize:11, fontWeight:700, background:gold, color:"#0a0a0a", letterSpacing:"0.05em", boxShadow:"0 4px 20px rgba(201,168,76,0.4)", whiteSpace:"nowrap", fontFamily:"'DM Sans', sans-serif" }}>✦ সবচেয়ে জনপ্রিয়</div>}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6, marginTop: p.hot ? 8 : 0 }}>
                      <span style={{ fontSize:24 }}>{p.icon}</span>
                      <span style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:24, fontWeight:700, color: p.hot ? "#f5d780" : "#FFFFFF" }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", marginBottom:24, fontFamily:"'DM Sans', sans-serif" }}>{p.desc}</div>
                    <div style={{ marginBottom:8, display:"flex", alignItems:"baseline", gap:4 }}>
                      <span style={{ fontSize:17, color:"rgba(201,168,76,0.8)", fontFamily:"'DM Sans', sans-serif", fontWeight:600 }}>৳</span>
                      <span style={{ fontSize:"clamp(40px,8vw,56px)", fontWeight:700, fontFamily:"'Cormorant Garamond', serif", lineHeight:1, ...(p.hot ? goldText : { color:"#FFFFFF" }) }}>{price.toLocaleString("bn-BD")}</span>
                      <span style={{ fontSize:14, color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans', sans-serif" }}>/{billingCycle === "monthly" ? "মাস" : "বছর"}</span>
                    </div>
                    {billingCycle === "yearly" && (
                      <div style={{ fontSize:12, color:"#4ade80", fontFamily:"'DM Sans', sans-serif", marginBottom:20 }}>
                        ৳{(p.price_monthly * 12 - p.price_yearly).toLocaleString("bn-BD")} সাশ্রয় হচ্ছে বার্ষিকে
                      </div>
                    )}
                    <div style={{ borderTop:"1px solid rgba(201,168,76,0.15)", paddingTop:24, marginBottom:24, flex:1, marginTop: billingCycle === "yearly" ? 0 : 16 }}>
                      {p.features.map((f, fi) => (
                        <div key={fi} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                          <span style={{ ...goldText, fontSize:12, fontWeight:800, flexShrink:0 }}>✦</span>
                          <span style={{ fontSize:"clamp(12px,2.5vw,14px)", color:"rgba(255,255,255,0.8)", fontFamily:"'DM Sans', sans-serif" }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <a href="/login" style={{ display:"block", textAlign:"center", padding:"13px", borderRadius:10, fontSize:14, fontWeight:700, textDecoration:"none", background: p.hot ? gold : "transparent", color: p.hot ? "#0a0a0a" : "#f5d780", border: p.hot ? "none" : "1px solid rgba(201,168,76,0.4)", boxShadow: p.hot ? "0 6px 24px rgba(201,168,76,0.3)" : "none", fontFamily:"'DM Sans', sans-serif", transition:"all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.opacity="0.85"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity="1"; }}>
                      {FREE_TRIAL_DAYS} দিন ফ্রিতে শুরু করুন →
                    </a>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal delay={0.35}>
            <p style={{ textAlign:"center", color:"rgba(245,215,128,0.65)", fontSize:"clamp(12px,2.5vw,14px)", marginTop:28, fontFamily:"'DM Sans', sans-serif" }}>
              ✦ সব প্ল্যানে <span style={{ color:"#f5d780", fontWeight:700 }}>{FREE_TRIAL_DAYS} দিনের ফ্রি ট্রায়াল</span> — কোনো ক্রেডিট কার্ড লাগবে না
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section style={{ padding:"clamp(48px,8vw,80px) clamp(16px,5vw,32px)", backgroundColor:"#0a0a0a" }}>
        <div style={{ maxWidth:860, margin:"0 auto" }}>
          <Reveal>
            <div style={{ borderRadius:24, padding:"clamp(36px,7vw,72px) clamp(20px,6vw,48px)", textAlign:"center", position:"relative", overflow:"hidden", border:"1px solid rgba(201,168,76,0.3)", background:"linear-gradient(135deg, #141414 0%, #100f08 100%)" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:gold, opacity:0.5 }} />
              <div style={{ position:"absolute", bottom:0, left:0, right:0, height:1, background:gold, opacity:0.25 }} />
              <div style={{ position:"relative", zIndex:1 }}>
                <div style={{ display:"flex", justifyContent:"center", gap:5, marginBottom:16 }}>
                  {[...Array(5)].map((_,i) => <Star key={i} size={15} fill="#f5d780" color="#f5d780" />)}
                </div>
                <div style={{ fontSize:11, letterSpacing:"0.4em", color:"#f5d780", fontFamily:"monospace", textTransform:"uppercase", marginBottom:16, fontWeight:600 }}>✦ আজই শুরু করুন ✦</div>
                <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(26px,5vw,56px)", fontWeight:700, color:"#FFFFFF", marginBottom:14, lineHeight:1.2 }}>
                  আপনার রেস্টুরেন্টকে<br /><span style={goldText}>ডিজিটাল করুন!</span>
                </h2>
                <p style={{ color:"rgba(255,255,255,0.7)", fontSize:"clamp(13px,3vw,16px)", marginBottom:32, maxWidth:420, margin:"0 auto 32px", fontFamily:"'DM Sans', sans-serif", lineHeight:1.7 }}>
                  ফ্রি ট্রায়ালে সব ফিচার ব্যবহার করুন। কোনো ঝামেলা নেই।
                </p>
                <a href="/login" style={{ display:"inline-flex", alignItems:"center", gap:10, padding:"clamp(12px,2.5vw,16px) clamp(28px,5vw,48px)", borderRadius:10, fontSize:"clamp(13px,3vw,15px)", fontWeight:700, color:"#0a0a0a", textDecoration:"none", background:gold, boxShadow:"0 8px 40px rgba(201,168,76,0.35)", fontFamily:"'DM Sans', sans-serif", transition:"all 0.3s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 14px 50px rgba(201,168,76,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 8px 40px rgba(201,168,76,0.35)"; }}>
                  ফ্রি ট্রায়াল শুরু করুন <ArrowRight size={15} />
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── CONTACT ─── */}
      <section id="contact" style={{ padding:"clamp(56px,10vw,100px) clamp(16px,5vw,32px)", backgroundColor:"#0d0d0d", borderTop:"1px solid rgba(201,168,76,0.08)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:"clamp(36px,6vw,56px)" }}>
              <div style={{ fontSize:10, letterSpacing:"0.4em", color:"rgba(201,168,76,0.7)", fontFamily:"monospace", textTransform:"uppercase", marginBottom:12, fontWeight:600 }}>✦ যোগাযোগ ✦</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(28px,5vw,48px)", fontWeight:700, color:"#FFFFFF", marginBottom:12, lineHeight:1.2 }}>
                সাহায্য দরকার? <span style={goldText}>আমরা আছি</span>
              </h2>
              <p style={{ color:"rgba(255,255,255,0.5)", fontSize:"clamp(13px,2.5vw,15px)", maxWidth:440, margin:"0 auto", fontFamily:"'DM Sans', sans-serif", lineHeight:1.7 }}>
                যেকোনো সমস্যায় সরাসরি যোগাযোগ করুন — দ্রুত সাড়া দেওয়া হবে।
              </p>
            </div>
          </Reveal>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:20, maxWidth:680, margin:"0 auto" }}>
            {[
              {
                icon: "💬",
                title: "WhatsApp",
                desc: "সবচেয়ে দ্রুত সাড়া পাবেন — সাধারণত ১ ঘন্টায়",
                value: "+880 1786-130439",
                href: "https://wa.me/8801786130439?text=আমি%20QRManager%20সম্পর্কে%20জানতে%20চাই",
                btnText: "WhatsApp করুন",
                color: "#25D366",
                bg: "rgba(37,211,102,0.08)",
                border: "rgba(37,211,102,0.2)",
              },
              {
                icon: "📘",
                title: "Facebook Page",
                desc: "মেসেজ পাঠান অথবা পোস্টে জিজ্ঞেস করুন",
                value: "NexCore Technologies",
                href: "https://facebook.com/nexcoreltd",
                btnText: "Facebook-এ যান",
                color: "#1877F2",
                bg: "rgba(24,119,242,0.08)",
                border: "rgba(24,119,242,0.2)",
              },
            ].map((c, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div style={{ borderRadius:20, padding:"clamp(24px,4vw,32px)", backgroundColor:"#111111", border:`1px solid ${c.border}`, background:`linear-gradient(135deg, #111 0%, #0d0d0d 100%)`, display:"flex", flexDirection:"column", gap:16, transition:"all 0.3s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow=`0 16px 48px ${c.bg}`; e.currentTarget.style.borderColor=c.color.replace(")", ",0.4)").replace("rgb","rgba"); }}
                  onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.borderColor=c.border; }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:48, height:48, borderRadius:14, background:c.bg, border:`1px solid ${c.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                      {c.icon}
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"#FFFFFF", fontFamily:"'DM Sans', sans-serif" }}>{c.title}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", fontFamily:"'DM Sans', sans-serif", marginTop:1 }}>{c.desc}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:c.color, fontFamily:"monospace", padding:"10px 14px", borderRadius:10, background:c.bg, border:`1px solid ${c.border}` }}>
                    {c.value}
                  </div>
                  <a href={c.href} target="_blank" rel="noopener noreferrer"
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"12px", borderRadius:10, fontSize:13, fontWeight:700, textDecoration:"none", color:"#0a0a0a", background:c.color, fontFamily:"'DM Sans', sans-serif", transition:"opacity 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity="0.85"}
                    onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                    {c.btnText} →
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Location + hours */}
          <Reveal delay={0.3}>
            <div style={{ marginTop:32, display:"flex", flexWrap:"wrap", gap:16, justifyContent:"center" }}>
              {[
                { icon:"📍", text:"সিলেট, বাংলাদেশ" },
                { icon:"🕐", text:"সাপোর্ট: সকাল ৯টা — রাত ১০টা" },
                { icon:"⚡", text:"সাধারণত ১-২ ঘন্টায় রিপ্লাই" },
              ].map((item, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:100, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", fontSize:13, color:"rgba(255,255,255,0.6)", fontFamily:"'DM Sans', sans-serif" }}>
                  <span>{item.icon}</span> {item.text}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── NCT BAR ─── */}
      <div style={{ backgroundColor:"#060606", borderTop:"1px solid rgba(201,168,76,0.12)", padding:"12px clamp(16px,4vw,32px)", display:"flex", alignItems:"center", justifyContent:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ fontSize:9, letterSpacing:"0.3em", color:"rgba(255,255,255,0.4)", fontFamily:"monospace", textTransform:"uppercase" }}>A Product of</span>
        <a href="https://nexcoreltd.com" target="_blank" rel="noopener noreferrer" style={{ fontSize:9, letterSpacing:"0.3em", color:"rgba(201,168,76,0.65)", fontFamily:"monospace", textTransform:"uppercase", textDecoration:"none", transition:"color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color="#f5d780"}
          onMouseLeave={e => e.currentTarget.style.color="rgba(201,168,76,0.65)"}>
          ⬡ NexCore Technologies Ltd.
        </a>
        <span style={{ fontSize:9, letterSpacing:"0.3em", color:"rgba(255,255,255,0.4)", fontFamily:"monospace", textTransform:"uppercase" }}>· Bangladesh 🇧🇩</span>
      </div>

      {/* ─── FOOTER ─── */}
      <footer style={{ backgroundColor:"#080808", borderTop:"1px solid rgba(201,168,76,0.08)", padding:"clamp(32px,5vw,52px) clamp(16px,4vw,32px)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", textAlign:"center" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:20 }}>
            <div style={{ width:36, height:36, borderRadius:9, background:gold, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <UtensilsCrossed size={16} color="#0a0a0a" />
            </div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontFamily:"'Cormorant Garamond', serif", fontWeight:700, fontSize:17, color:"#f5d780" }}>{APP_NAME}</div>
              <div style={{ fontSize:7, letterSpacing:"0.2em", color:"rgba(201,168,76,0.55)", textTransform:"uppercase", fontFamily:"monospace" }}>by {COMPANY_NAME.replace(" Ltd.", "")}</div>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:"clamp(16px,4vw,32px)", flexWrap:"wrap", marginBottom:20 }}>
            {[["ফিচার","#features"],["প্রাইসিং","#pricing"],["ডেমো","/menu/demo"],["যোগাযোগ","#contact"],["লগইন","/login"]].map(([l,h]) => (
              <a key={l} href={h} style={{ fontSize:13, color:"rgba(255,255,255,0.55)", textDecoration:"none", fontFamily:"'DM Sans', sans-serif", transition:"color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color="#f5d780"}
                onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.55)"}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize:"clamp(11px,2.5vw,13px)", color:"rgba(255,255,255,0.35)", fontFamily:"'DM Sans', sans-serif" }}>
            © {new Date().getFullYear()} {APP_NAME} — একটি{" "}
            <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer" style={{ color:"rgba(201,168,76,0.65)", textDecoration:"none" }}>{COMPANY_NAME}</a>{" "}
            পণ্য · সকল অধিকার সংরক্ষিত
          </p>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        @keyframes floatUp {
          0%   { transform:translateY(0) rotate(0deg); opacity:0; }
          8%   { opacity:0.07; } 92% { opacity:0.07; }
          100% { transform:translateY(-110vh) rotate(360deg); opacity:0; }
        }
        @keyframes fadeUp { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeDown { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:0.12; transform:scale(1); } 50% { opacity:0.22; transform:scale(1.05); } }
        @keyframes glow { 0%,100% { box-shadow:0 0 8px rgba(201,168,76,0.9); } 50% { box-shadow:0 0 18px rgba(201,168,76,1); } }
        html { scroll-behavior:smooth; }
      `}</style>
    </div>
  );
}
