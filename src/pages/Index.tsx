import { Link } from "react-router-dom";
import { UtensilsCrossed, ArrowRight, Star } from "lucide-react";
import { useEffect, useState, useRef } from "react";

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

const Reveal = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0px)" : "translateY(48px)",
      transition: `opacity 0.9s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.9s ${delay}s cubic-bezier(0.16,1,0.3,1)`,
    }}>{children}</div>
  );
};

export default function Index() {
  const [emojis, setEmojis] = useState<FE[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setEmojis(Array.from({ length: 10 }, (_, i) => ({
      id: i, emoji: floatingEmojis[i % floatingEmojis.length],
      left: Math.random() * 100, delay: Math.random() * 14,
      duration: 18 + Math.random() * 12, size: 14 + Math.random() * 16,
    })));
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const gold = "linear-gradient(135deg, #c9a84c, #f5d780, #b8860b)";
  const goldText = { background: gold, WebkitBackgroundClip: "text" as const, WebkitTextFillColor: "transparent" as const };

  return (
    <div style={{ fontFamily:"'Cormorant Garamond', 'DM Sans', serif", backgroundColor:"#0a0a0a", color:"#e8dcc8", minHeight:"100vh" }}>

      {/* Floating emojis */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        {emojis.map(e => (
          <span key={e.id} style={{
            position:"absolute", left:`${e.left}%`, bottom:"-50px",
            fontSize:`${e.size}px`, opacity:0.07, userSelect:"none",
            animation:`floatUp ${e.duration}s ${e.delay}s linear infinite`,
          }}>{e.emoji}</span>
        ))}
      </div>

      {/* ─── NAVBAR ─── */}
      <nav style={{
        position:"sticky", top:0, zIndex:100,
        backgroundColor: scrolled ? "rgba(10,10,10,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent",
        transition:"all 0.5s ease",
      }}>
        <div style={{ maxWidth:1140, margin:"0 auto", padding:"0 32px", height:72, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{
              width:46, height:46, borderRadius:12,
              background: gold,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 24px rgba(201,168,76,0.4)",
            }}>
              <UtensilsCrossed size={22} color="#0a0a0a" />
            </div>
            <div>
              <div style={{ fontFamily:"'Cormorant Garamond', serif", fontWeight:700, fontSize:20, color:"#FFFFFF", letterSpacing:"0.02em" }}> QRManager</div>
              <div style={{ fontSize:9, letterSpacing:"0.3em", color:"rgba(201,168,76,0.7)", textTransform:"uppercase", fontFamily:"monospace" }}>by NexCore Technologies</div>
            </div>
          </div>

          <div style={{ display:"flex", gap:40 }} className="hidden md:flex">
            {[["ফিচার","#features"],["প্রাইসিং","#pricing"],["ডেমো","/menu/demo"]].map(([l,h]) => (
              <a key={l} href={h} style={{ fontSize:14, fontWeight:500, color:"rgba(255,255,255,0.75)", textDecoration:"none", letterSpacing:"0.05em", transition:"color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color="#f5d780"}
                onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.75)"}>{l}</a>
            ))}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <a href="/menu/demo" style={{
              padding:"9px 20px", borderRadius:8, fontSize:13, fontWeight:600,
              color:"#f5d780", textDecoration:"none",
              border:"1px solid rgba(201,168,76,0.45)", transition:"all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(201,168,76,0.9)"; e.currentTarget.style.backgroundColor="rgba(201,168,76,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(201,168,76,0.45)"; e.currentTarget.style.backgroundColor="transparent"; }}>
              ডেমো
            </a>
            <a href="/login" style={{
              padding:"9px 22px", borderRadius:8, fontSize:13, fontWeight:700,
              color:"#0a0a0a", textDecoration:"none", background: gold,
              boxShadow:"0 4px 20px rgba(201,168,76,0.35)",
              display:"flex", alignItems:"center", gap:6, transition:"all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow="0 6px 28px rgba(201,168,76,0.55)"; e.currentTarget.style.transform="translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow="0 4px 20px rgba(201,168,76,0.35)"; e.currentTarget.style.transform="translateY(0)"; }}>
              লগইন <ArrowRight size={13} />
            </a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ position:"relative", minHeight:"96vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0 }}>
          <div style={{ position:"absolute", top:"10%", left:"50%", transform:"translateX(-50%)", width:800, height:800, borderRadius:"50%", background:"radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%)" }} />
          <div style={{ position:"absolute", top:"20%", right:"-10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)" }} />
          <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(201,168,76,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.05) 1px, transparent 1px)", backgroundSize:"60px 60px" }} />
          <div style={{ position:"absolute", top:"35%", left:0, right:0, height:"1px", background:"linear-gradient(90deg, transparent, rgba(201,168,76,0.12), transparent)" }} />
        </div>

        <div style={{ maxWidth:900, margin:"0 auto", padding:"80px 32px", position:"relative", zIndex:1, textAlign:"center" }}>

          {/* Badge */}
          <div style={{ animation:"fadeDown 0.8s 0.1s ease both", marginBottom:40 }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:10,
              padding:"10px 24px", borderRadius:100,
              border:"1px solid rgba(201,168,76,0.45)",
              background:"linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.05))",
              fontSize:12, fontWeight:600, color:"#f5d780", letterSpacing:"0.08em",
            }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:gold, display:"inline-block", boxShadow:"0 0 8px rgba(201,168,76,0.9)", animation:"glow 2s infinite" }} />
              BANGLADESH'S PREMIER RESTAURANT SOLUTION
              <span style={{ padding:"2px 10px", borderRadius:20, fontSize:10, fontWeight:700, background:"rgba(201,168,76,0.2)", color:"#f5d780", letterSpacing:"0.1em" }}>NEW</span>
            </div>
          </div>

          {/* App Icon */}
          <div style={{ marginBottom:36, animation:"fadeDown 0.8s 0s ease both", display:"inline-block", position:"relative" }}>
            <div style={{
              width:120, height:120, borderRadius:32,
              background: gold,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 0 1px rgba(201,168,76,0.4), 0 0 60px rgba(201,168,76,0.3), 0 24px 48px rgba(0,0,0,0.5)",
              position:"relative", zIndex:1,
            }}>
              <UtensilsCrossed size={54} color="#0a0a0a" />
            </div>
            <div style={{ position:"absolute", inset:-12, borderRadius:44, background:gold, opacity:0.15, filter:"blur(24px)", animation:"pulse 4s infinite" }} />
          </div>

          {/* Headline */}
          <div style={{ animation:"fadeUp 0.8s 0.25s ease both" }}>
            <h1 style={{
              fontFamily:"'Cormorant Garamond', serif",
              fontSize:"clamp(52px, 9vw, 108px)",
              fontWeight:700, lineHeight:1.02,
              color:"#FFFFFF", marginBottom:24,
              letterSpacing:"-0.02em",
            }}>
              স্মার্ট রেস্টুরেন্ট
            </h1>
            <h1 style={{
              fontFamily:"'Cormorant Garamond', serif",
              fontSize:"clamp(52px, 9vw, 108px)",
              fontWeight:700, lineHeight:1.3,
              marginBottom:32, letterSpacing:"-0.02em",
              padding:"12px 4px",
              ...goldText,
            }}>
              অর্ডারিং সিস্টেম
            </h1>
          </div>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginBottom:28, animation:"fadeUp 0.8s 0.35s ease both" }}>
            <div style={{ height:"1px", width:60, background:"linear-gradient(90deg, transparent, rgba(201,168,76,0.6))" }} />
            <span style={{ color:"rgba(201,168,76,0.8)", fontSize:16 }}>✦</span>
            <div style={{ height:"1px", width:60, background:"linear-gradient(90deg, rgba(201,168,76,0.6), transparent)" }} />
          </div>

          {/* Subtext */}
          <p style={{ fontSize:18, lineHeight:1.8, color:"rgba(255,255,255,0.8)", maxWidth:520, margin:"0 auto 44px", fontFamily:"'DM Sans', sans-serif", animation:"fadeUp 0.8s 0.45s ease both" }}>
            QR কোড স্ক্যান করুন, মেনু দেখুন, অর্ডার দিন —{" "}
            <span style={{ color:"#f5d780", fontWeight:700 }}>কোনো অ্যাপ ছাড়াই!</span>{" "}
            রান্নাঘর রিয়েলটাইম অর্ডার পায়।
          </p>

          {/* CTAs */}
          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:40, animation:"fadeUp 0.8s 0.55s ease both" }}>
            <a href="/login" style={{
              padding:"16px 40px", borderRadius:10, fontSize:15, fontWeight:700,
              color:"#0a0a0a", textDecoration:"none", background: gold,
              boxShadow:"0 8px 32px rgba(201,168,76,0.35)",
              display:"flex", alignItems:"center", gap:8,
              fontFamily:"'DM Sans', sans-serif", letterSpacing:"0.02em",
              transition:"all 0.3s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow="0 14px 44px rgba(201,168,76,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform="translateY(0) scale(1)"; e.currentTarget.style.boxShadow="0 8px 32px rgba(201,168,76,0.35)"; }}>
              শুরু করুন — বিনামূল্যে <ArrowRight size={16} />
            </a>
            <a href="/menu/demo" style={{
              padding:"16px 40px", borderRadius:10, fontSize:15, fontWeight:600,
              color:"#f5d780", textDecoration:"none",
              border:"1px solid rgba(201,168,76,0.45)", transition:"all 0.3s",
              fontFamily:"'DM Sans', sans-serif",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(201,168,76,0.9)"; e.currentTarget.style.backgroundColor="rgba(201,168,76,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(201,168,76,0.45)"; e.currentTarget.style.backgroundColor="transparent"; }}>
              🎮 লাইভ ডেমো দেখুন
            </a>
          </div>

          {/* Trust */}
          <div style={{ display:"flex", gap:28, justifyContent:"center", flexWrap:"wrap", animation:"fadeUp 0.8s 0.65s ease both" }}>
            {["✓ ৭ দিন ফ্রি ট্রায়াল","✓ ক্রেডিট কার্ড লাগবে না","✓ যেকোনো সময় বাতিল"].map((t,i) => (
              <span key={i} style={{ fontSize:13, color:"rgba(245,215,128,0.75)", fontFamily:"'DM Sans', sans-serif", letterSpacing:"0.03em", fontWeight:500 }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="features" style={{ padding:"120px 32px", backgroundColor:"#0d0d0d" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:72 }}>
              <div style={{ fontSize:11, letterSpacing:"0.4em", color:"#f5d780", textTransform:"uppercase", fontFamily:"monospace", marginBottom:16, fontWeight:600 }}>✦ কিভাবে কাজ করে ✦</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(36px,5vw,60px)", fontWeight:700, color:"#FFFFFF", marginBottom:16 }}>
                তিনটি সহজ{" "}<span style={goldText}>ধাপ</span>
              </h2>
              <p style={{ fontSize:16, color:"rgba(255,255,255,0.65)", maxWidth:380, margin:"0 auto", fontFamily:"'DM Sans', sans-serif" }}>মিনিটের মধ্যে আপনার রেস্টুরেন্ট ডিজিটাল হয়ে যাক</p>
            </div>
          </Reveal>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:2 }}>
            {[
              { emoji:"📱", step:"01", title:"QR স্ক্যান করুন", desc:"টেবিলের QR স্ক্যান করলেই মেনু — কোনো অ্যাপ লাগবে না!" },
              { emoji:"🍽️", step:"02", title:"অর্ডার দিন", desc:"পছন্দের খাবার বেছে এক ক্লিকে অর্ডার। প্রতিটি সিটে আলাদা অর্ডার!" },
              { emoji:"⚡", step:"03", title:"রিয়েলটাইম আপডেট", desc:"রান্নাঘর সাথে সাথে অর্ডার পায়। স্ট্যাটাস রিয়েলটাইমে ট্র্যাক করুন!" },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.15}>
                <div style={{
                  padding:"44px 36px", backgroundColor:"#141414",
                  border:"1px solid rgba(201,168,76,0.15)",
                  transition:"all 0.4s", position:"relative", overflow:"hidden",
                  borderRadius: i === 0 ? "20px 0 0 20px" : i === 2 ? "0 20px 20px 0" : "0",
                  borderLeft: i > 0 ? "none" : "1px solid rgba(201,168,76,0.15)",
                }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor="#1a1a1a"; e.currentTarget.style.borderColor="rgba(201,168,76,0.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor="#141414"; e.currentTarget.style.borderColor="rgba(201,168,76,0.15)"; }}>
                  <div style={{ position:"absolute", top:24, right:24, fontFamily:"monospace", fontSize:48, fontWeight:800, color:"rgba(201,168,76,0.1)", lineHeight:1 }}>{f.step}</div>
                  <div style={{ fontSize:44, marginBottom:24 }}>{f.emoji}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:24, fontWeight:700, color:"#FFFFFF", marginBottom:12 }}>{f.title}</div>
                  <div style={{ fontSize:15, color:"rgba(255,255,255,0.7)", lineHeight:1.8, fontFamily:"'DM Sans', sans-serif" }}>{f.desc}</div>
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, height:2, background:gold, opacity:0, transition:"opacity 0.3s" }} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section style={{ padding:"120px 32px", backgroundColor:"#0a0a0a" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:72 }}>
              <div style={{ fontSize:11, letterSpacing:"0.4em", color:"#f5d780", textTransform:"uppercase", fontFamily:"monospace", marginBottom:16, fontWeight:600 }}>✦ সুবিধাসমূহ ✦</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(36px,5vw,60px)", fontWeight:700, color:"#FFFFFF" }}>
                সব কিছু <span style={goldText}>এক জায়গায়</span>
              </h2>
            </div>
          </Reveal>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))", gap:1 }}>
            {[
              { emoji:"📱", title:"QR ডিজিটাল মেনু", desc:"টেবিলে QR রাখুন — স্ক্যান করলেই সুন্দর মেনু।" },
              { emoji:"⚡", title:"রিয়েলটাইম অর্ডার", desc:"অর্ডার হওয়ার সাথে সাথে কিচেনে চলে যায়।" },
              { emoji:"🪑", title:"টেবিল ম্যানেজমেন্ট", desc:"কোন টেবিল ফাঁকা, কোনটায় অর্ডার — এক স্ক্রিনে।" },
              { emoji:"👥", title:"মাল্টি-রোল স্টাফ", desc:"Super Admin, Admin, Waiter — সবার আলাদা dashboard।" },
              { emoji:"📊", title:"অ্যানালিটিক্স", desc:"বেস্ট সেলার, রেভিনিউ, পিক আওয়ার — সব data।" },
              { emoji:"🏢", title:"মাল্টি-ব্রাঞ্চ", desc:"একাধিক রেস্টুরেন্ট একটি account থেকে পরিচালনা।" },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div style={{
                  padding:"32px 28px", backgroundColor:"#111111",
                  border:"1px solid rgba(201,168,76,0.12)",
                  transition:"all 0.3s", cursor:"default",
                }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor="#161616"; e.currentTarget.style.borderColor="rgba(201,168,76,0.35)"; e.currentTarget.style.transform="translateY(-3px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor="#111111"; e.currentTarget.style.borderColor="rgba(201,168,76,0.12)"; e.currentTarget.style.transform="translateY(0)"; }}>
                  <div style={{ fontSize:32, marginBottom:16 }}>{f.emoji}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:20, fontWeight:700, color:"#f5d780", marginBottom:10 }}>{f.title}</div>
                  <div style={{ fontSize:14, color:"rgba(255,255,255,0.7)", lineHeight:1.75, fontFamily:"'DM Sans', sans-serif" }}>{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" style={{ padding:"120px 32px", backgroundColor:"#0d0d0d" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:72 }}>
              <div style={{ fontSize:11, letterSpacing:"0.4em", color:"#f5d780", textTransform:"uppercase", fontFamily:"monospace", marginBottom:16, fontWeight:600 }}>✦ মূল্য পরিকল্পনা ✦</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(36px,5vw,60px)", fontWeight:700, color:"#FFFFFF", marginBottom:12 }}>
                সাশ্রয়ী <span style={goldText}>প্রাইসিং</span>
              </h2>
              <p style={{ fontSize:16, color:"rgba(255,255,255,0.65)", fontFamily:"'DM Sans', sans-serif" }}>আপনার রেস্টুরেন্টের আকার অনুযায়ী প্ল্যান বেছে নিন</p>
            </div>
          </Reveal>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:24 }}>
            {[
              { name:"বেসিক", price:"৪৯৯", desc:"ছোট রেস্টুরেন্টের জন্য", features:["৫০টি মেনু আইটেম","৫টি টেবিল","৩ জন স্টাফ","QR অর্ডারিং","রিয়েলটাইম নোটিফিকেশন"], hot:false, delay:0 },
              { name:"প্রিমিয়াম", price:"৭৯৯", desc:"বড় রেস্টুরেন্টের সেরা চয়েস", features:["২০০টি মেনু আইটেম","২০টি টেবিল","১৫ জন স্টাফ","সব বেসিক ফিচার","অ্যানালিটিক্স ড্যাশবোর্ড","প্রায়োরিটি সাপোর্ট"], hot:true, delay:0.1 },
              { name:"এন্টারপ্রাইজ", price:"১,২৯৯", desc:"চেইন রেস্টুরেন্টের জন্য", features:["আনলিমিটেড মেনু","আনলিমিটেড টেবিল","আনলিমিটেড স্টাফ","সব প্রিমিয়াম ফিচার","মাল্টি-ব্রাঞ্চ","ডেডিকেটেড সাপোর্ট"], hot:false, delay:0.2 },
            ].map((p, i) => (
              <Reveal key={i} delay={p.delay}>
                <div style={{
                  borderRadius:20, padding:"40px 32px",
                  backgroundColor: p.hot ? "#141414" : "#111111",
                  border: p.hot ? "1px solid rgba(201,168,76,0.5)" : "1px solid rgba(201,168,76,0.15)",
                  boxShadow: p.hot ? "0 0 60px rgba(201,168,76,0.1), inset 0 1px 0 rgba(201,168,76,0.2)" : "none",
                  position:"relative", display:"flex", flexDirection:"column",
                  transform: p.hot ? "scale(1.02)" : "scale(1)",
                  transition:"all 0.3s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = p.hot ? "scale(1.02) translateY(-4px)" : "translateY(-4px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = p.hot ? "scale(1.02)" : "translateY(0)"; }}>
                  {p.hot && (
                    <div style={{
                      position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)",
                      padding:"5px 20px", borderRadius:100, fontSize:11, fontWeight:700,
                      background: gold, color:"#0a0a0a", letterSpacing:"0.05em",
                      boxShadow:"0 4px 20px rgba(201,168,76,0.4)", whiteSpace:"nowrap",
                      fontFamily:"'DM Sans', sans-serif",
                    }}>✦ সবচেয়ে জনপ্রিয়</div>
                  )}

                  <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:26, fontWeight:700, color: p.hot ? "#f5d780" : "#FFFFFF", marginBottom:6 }}>{p.name}</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", marginBottom:28, fontFamily:"'DM Sans', sans-serif" }}>{p.desc}</div>

                  <div style={{ marginBottom:32, display:"flex", alignItems:"baseline", gap:4 }}>
                    <span style={{ fontSize:18, color:"rgba(201,168,76,0.8)", fontFamily:"'DM Sans', sans-serif", fontWeight:600 }}>৳</span>
                    <span style={{ fontSize:56, fontWeight:700, fontFamily:"'Cormorant Garamond', serif", lineHeight:1, ...( p.hot ? goldText : { color:"#FFFFFF" }) }}>{p.price}</span>
                    <span style={{ fontSize:14, color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans', sans-serif" }}>/মাস</span>
                  </div>

                  <div style={{ borderTop:"1px solid rgba(201,168,76,0.15)", paddingTop:28, marginBottom:28, flex:1 }}>
                    {p.features.map((f, fi) => (
                      <div key={fi} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                        <span style={{ ...goldText, fontSize:12, fontWeight:800, flexShrink:0 }}>✦</span>
                        <span style={{ fontSize:14, color:"rgba(255,255,255,0.8)", fontFamily:"'DM Sans', sans-serif" }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <a href="/login" style={{
                    display:"block", textAlign:"center", padding:"14px",
                    borderRadius:10, fontSize:14, fontWeight:700, textDecoration:"none",
                    background: p.hot ? gold : "transparent",
                    color: p.hot ? "#0a0a0a" : "#f5d780",
                    border: p.hot ? "none" : "1px solid rgba(201,168,76,0.4)",
                    boxShadow: p.hot ? "0 6px 24px rgba(201,168,76,0.3)" : "none",
                    fontFamily:"'DM Sans', sans-serif", letterSpacing:"0.03em",
                    transition:"all 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity="0.85"; e.currentTarget.style.transform="translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="translateY(0)"; }}>
                    শুরু করুন →
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.35}>
            <p style={{ textAlign:"center", color:"rgba(245,215,128,0.65)", fontSize:14, marginTop:32, fontFamily:"'DM Sans', sans-serif", letterSpacing:"0.03em" }}>
              ✦ সব প্ল্যানে <span style={{ color:"#f5d780", fontWeight:700 }}>৭ দিনের ফ্রি ট্রায়াল</span> — কোনো ক্রেডিট কার্ড লাগবে না
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section style={{ padding:"80px 32px", backgroundColor:"#0a0a0a" }}>
        <div style={{ maxWidth:860, margin:"0 auto" }}>
          <Reveal>
            <div style={{
              borderRadius:28, padding:"72px 48px", textAlign:"center", position:"relative", overflow:"hidden",
              border:"1px solid rgba(201,168,76,0.3)",
              background:"linear-gradient(135deg, #141414 0%, #100f08 100%)",
              boxShadow:"0 0 80px rgba(201,168,76,0.07)",
            }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:gold, opacity:0.5 }} />
              <div style={{ position:"absolute", bottom:0, left:0, right:0, height:1, background:gold, opacity:0.25 }} />
              <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:600, height:300, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)" }} />

              <div style={{ position:"relative", zIndex:1 }}>
                <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:20 }}>
                  {[...Array(5)].map((_,i) => <Star key={i} size={18} fill="#f5d780" color="#f5d780" />)}
                </div>
                <div style={{ fontSize:11, letterSpacing:"0.4em", color:"#f5d780", fontFamily:"monospace", textTransform:"uppercase", marginBottom:20, fontWeight:600 }}>✦ আজই শুরু করুন ✦</div>
                <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"clamp(32px,5vw,56px)", fontWeight:700, color:"#FFFFFF", marginBottom:16, lineHeight:1.2 }}>
                  আপনার রেস্টুরেন্টকে<br /><span style={goldText}>ডিজিটাল করুন!</span>
                </h2>
                <p style={{ color:"rgba(255,255,255,0.7)", fontSize:16, marginBottom:40, maxWidth:440, margin:"0 auto 40px", fontFamily:"'DM Sans', sans-serif", lineHeight:1.7 }}>
                  ফ্রি ট্রায়ালে সব ফিচার ব্যবহার করুন। কোনো ঝামেলা নেই।
                </p>
                <a href="/login" style={{
                  display:"inline-flex", alignItems:"center", gap:10,
                  padding:"16px 48px", borderRadius:10, fontSize:15, fontWeight:700,
                  color:"#0a0a0a", textDecoration:"none", background: gold,
                  boxShadow:"0 8px 40px rgba(201,168,76,0.35)",
                  fontFamily:"'DM Sans', sans-serif", letterSpacing:"0.03em",
                  transition:"all 0.3s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 14px 50px rgba(201,168,76,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 8px 40px rgba(201,168,76,0.35)"; }}>
                  ফ্রি ট্রায়াল শুরু করুন <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── NCT BAR ─── */}
      <div style={{ backgroundColor:"#060606", borderTop:"1px solid rgba(201,168,76,0.12)", padding:"14px 32px", display:"flex", alignItems:"center", justifyContent:"center", gap:16, flexWrap:"wrap" }}>
        <span style={{ fontSize:10, letterSpacing:"0.35em", color:"rgba(255,255,255,0.4)", fontFamily:"monospace", textTransform:"uppercase" }}>A Product of</span>
        <a href="https://nexcoreltd.com" target="_blank" rel="noopener noreferrer"
          style={{ fontSize:10, letterSpacing:"0.35em", color:"rgba(201,168,76,0.65)", fontFamily:"monospace", textTransform:"uppercase", textDecoration:"none", transition:"color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color="#f5d780"}
          onMouseLeave={e => e.currentTarget.style.color="rgba(201,168,76,0.65)"}>
          ⬡ NexCore Technologies Ltd.
        </a>
        <span style={{ fontSize:10, letterSpacing:"0.35em", color:"rgba(255,255,255,0.4)", fontFamily:"monospace", textTransform:"uppercase" }}>· Bangladesh 🇧🇩</span>
      </div>

      {/* ─── FOOTER ─── */}
      <footer style={{ backgroundColor:"#080808", borderTop:"1px solid rgba(201,168,76,0.08)", padding:"52px 32px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", textAlign:"center" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, marginBottom:24 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:gold, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <UtensilsCrossed size={17} color="#0a0a0a" />
            </div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontFamily:"'Cormorant Garamond', serif", fontWeight:700, fontSize:18, color:"#f5d780" }}> QRManager</div>
              <div style={{ fontSize:9, letterSpacing:"0.25em", color:"rgba(201,168,76,0.55)", textTransform:"uppercase", fontFamily:"monospace" }}>by NexCore Technologies</div>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:32, flexWrap:"wrap", marginBottom:24 }}>
            {[["ফিচার","#features"],["প্রাইসিং","#pricing"],["ডেমো","/menu/demo"],["লগইন","/login"]].map(([l,h]) => (
              <a key={l} href={h} style={{ fontSize:14, color:"rgba(255,255,255,0.55)", textDecoration:"none", fontFamily:"'DM Sans', sans-serif", transition:"color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color="#f5d780"}
                onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.55)"}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize:13, color:"rgba(255,255,255,0.35)", fontFamily:"'DM Sans', sans-serif" }}>
            © 2025  QRManager — একটি{" "}
            <a href="https://nexcoreltd.com" target="_blank" rel="noopener noreferrer" style={{ color:"rgba(201,168,76,0.65)", textDecoration:"none" }}>NexCore Technologies Ltd.</a>{" "}
            পণ্য · সকল অধিকার সংরক্ষিত
          </p>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        @keyframes floatUp {
          0%   { transform:translateY(0) rotate(0deg); opacity:0; }
          8%   { opacity:0.07; }
          92%  { opacity:0.07; }
          100% { transform:translateY(-110vh) rotate(360deg); opacity:0; }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(28px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeDown {
          from { opacity:0; transform:translateY(-16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes pulse {
          0%,100% { opacity:0.12; transform:scale(1); }
          50%     { opacity:0.22; transform:scale(1.05); }
        }
        @keyframes glow {
          0%,100% { box-shadow:0 0 8px rgba(201,168,76,0.9); }
          50%     { box-shadow:0 0 18px rgba(201,168,76,1); }
        }
        html { scroll-behavior:smooth; }
      `}</style>
    </div>
  );
}
