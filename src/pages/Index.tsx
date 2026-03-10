import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { UtensilsCrossed, ArrowRight, Star, Zap, BarChart3, Users, QrCode, Shield } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const floatingEmojis = ["🍛","🍕","🍜","🥘","🍱","🥗","🍔","🍣","🧁","🍝","🌮","🥩"];

interface FE { id:number; emoji:string; left:number; delay:number; duration:number; size:number; }

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
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
      transform: visible ? "translateY(0px)" : "translateY(40px)",
      transition: `all 0.8s ${delay}s cubic-bezier(0.16, 1, 0.3, 1)`,
    }}>{children}</div>
  );
};

export default function Index() {
  const [emojis, setEmojis] = useState<FE[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setEmojis(Array.from({ length: 12 }, (_, i) => ({
      id: i, emoji: floatingEmojis[i % floatingEmojis.length],
      left: Math.random() * 100, delay: Math.random() * 12,
      duration: 16 + Math.random() * 10, size: 16 + Math.random() * 18,
    })));
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: "#ffffff", color: "#1a1209" }}>

      {/* Floating food emojis */}
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
        position:"sticky", top:0, zIndex:50,
        backgroundColor: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid #f0e8d8" : "1px solid transparent",
        boxShadow: scrolled ? "0 2px 24px rgba(0,0,0,0.06)" : "none",
        transition:"all 0.4s ease",
      }}>
        <div style={{ maxWidth:1120, margin:"0 auto", padding:"0 24px", height:68, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{
              width:44, height:44, borderRadius:14,
              background:"linear-gradient(135deg, #f97316, #dc2626)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 4px 20px rgba(249,115,22,0.4)",
            }}>
              <UtensilsCrossed size={20} color="white" />
            </div>
            <div style={{ lineHeight:1 }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontWeight:700, fontSize:18, color:"#1a1209" }}>Tasty QR Spot</div>
              <div style={{ fontSize:8, letterSpacing:"0.25em", color:"#a8896a", textTransform:"uppercase", fontFamily:"monospace", marginTop:2 }}>by NexCore Technologies</div>
            </div>
          </div>

          {/* Nav links */}
          <div style={{ display:"flex", alignItems:"center", gap:36 }} className="hidden md:flex">
            {[["ফিচার","#features"],["প্রাইসিং","#pricing"],["ডেমো","#demo"]].map(([l,h]) => (
              <a key={l} href={h} style={{ fontSize:14, fontWeight:500, color:"#6b5740", textDecoration:"none", transition:"color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color="#f97316")}
                onMouseLeave={e => (e.currentTarget.style.color="#6b5740")}>{l}</a>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display:"flex", gap:10 }}>
            <a href="/menu/demo" style={{
              padding:"8px 18px", borderRadius:10, fontSize:13, fontWeight:500,
              color:"#6b5740", textDecoration:"none", border:"1px solid #e8d5b7",
              transition:"all 0.2s", backgroundColor:"transparent",
            }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor="#fef3e2"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor="transparent"; }}>
              ডেমো
            </a>
            <a href="/login" style={{
              padding:"8px 20px", borderRadius:10, fontSize:13, fontWeight:600,
              color:"white", textDecoration:"none",
              background:"linear-gradient(135deg, #f97316, #dc2626)",
              boxShadow:"0 4px 14px rgba(249,115,22,0.4)",
              display:"flex", alignItems:"center", gap:6, transition:"all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow="0 6px 20px rgba(249,115,22,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 4px 14px rgba(249,115,22,0.4)"; }}>
              লগইন <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ position:"relative", minHeight:"94vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", backgroundColor:"#ffffff" }}>
        {/* Background decoration */}
        <div style={{ position:"absolute", inset:0, zIndex:0 }}>
          {/* Warm gradient blobs */}
          <div style={{ position:"absolute", top:"-10%", right:"-5%", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)" }} />
          <div style={{ position:"absolute", bottom:"-10%", left:"-5%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(220,38,38,0.06) 0%, transparent 70%)" }} />
          <div style={{ position:"absolute", top:"30%", left:"30%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(251,191,36,0.05) 0%, transparent 70%)" }} />
          {/* Subtle dot grid */}
          <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle, rgba(169,130,90,0.12) 1px, transparent 1px)", backgroundSize:"32px 32px", opacity:0.4 }} />
        </div>

        <div style={{ maxWidth:860, margin:"0 auto", padding:"80px 24px", position:"relative", zIndex:1, textAlign:"center" }}>
          {/* Badge */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:8,
            padding:"8px 20px", borderRadius:100,
            background:"linear-gradient(135deg, rgba(249,115,22,0.08), rgba(220,38,38,0.06))",
            border:"1px solid rgba(249,115,22,0.2)", marginBottom:32,
            fontSize:13, fontWeight:500, color:"#92400e",
            animation:"fadeDown 0.6s 0.1s ease both",
          }}>
            <span style={{ width:6, height:6, borderRadius:"50%", backgroundColor:"#f97316", display:"inline-block", animation:"ping 1.5s infinite" }} />
            বাংলাদেশের #১ রেস্টুরেন্ট সলিউশন
            <span style={{ backgroundColor:"rgba(249,115,22,0.15)", color:"#ea580c", padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:700 }}>NEW</span>
          </div>

          {/* App Icon */}
          <div style={{ marginBottom:28, animation:"fadeDown 0.6s 0s ease both", position:"relative", display:"inline-block" }}>
            <div style={{
              width:112, height:112, borderRadius:28,
              background:"linear-gradient(135deg, #f97316, #dc2626, #7c2d12)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 0 1px rgba(249,115,22,0.2), 0 20px 60px rgba(249,115,22,0.3), 0 8px 24px rgba(0,0,0,0.12)",
              position:"relative", zIndex:1,
            }}>
              <UtensilsCrossed size={52} color="white" />
            </div>
            <div style={{
              position:"absolute", inset:-8, borderRadius:36,
              background:"linear-gradient(135deg, #f97316, #dc2626)",
              opacity:0.2, filter:"blur(20px)", zIndex:0,
              animation:"pulse 3s infinite",
            }} />
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily:"'Playfair Display', serif",
            fontSize:"clamp(44px, 8vw, 88px)",
            fontWeight:800, lineHeight:1.05,
            color:"#1a1209", marginBottom:24,
            letterSpacing:"-0.02em",
            animation:"fadeUp 0.7s 0.2s ease both",
          }}>
            স্মার্ট রেস্টুরেন্ট<br />
            <span style={{ background:"linear-gradient(135deg, #f97316, #dc2626)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              অর্ডারিং
            </span>{" "}সিস্টেম
          </h1>

          {/* Subtext */}
          <p style={{ fontSize:18, lineHeight:1.7, color:"#78614a", maxWidth:560, margin:"0 auto 40px", animation:"fadeUp 0.7s 0.35s ease both" }}>
            QR কোড স্ক্যান করুন, মেনু দেখুন, অর্ডার দিন —{" "}
            <strong style={{ color:"#1a1209" }}>কোনো অ্যাপ ছাড়াই!</strong>{" "}
            রান্নাঘর সাথে সাথে রিয়েলটাইম অর্ডার পায়।
          </p>

          {/* Buttons */}
          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:36, animation:"fadeUp 0.7s 0.5s ease both" }}>
            <a href="/login" style={{
              padding:"16px 36px", borderRadius:16, fontSize:16, fontWeight:700,
              color:"white", textDecoration:"none",
              background:"linear-gradient(135deg, #f97316, #dc2626)",
              boxShadow:"0 8px 32px rgba(249,115,22,0.4)",
              display:"flex", alignItems:"center", gap:8, transition:"all 0.3s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow="0 14px 40px rgba(249,115,22,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform="translateY(0) scale(1)"; e.currentTarget.style.boxShadow="0 8px 32px rgba(249,115,22,0.4)"; }}>
              শুরু করুন — বিনামূল্যে <ArrowRight size={18} />
            </a>
            <a href="/menu/demo" style={{
              padding:"16px 36px", borderRadius:16, fontSize:16, fontWeight:600,
              color:"#92400e", textDecoration:"none", backgroundColor:"white",
              border:"2px solid #f0d9b8", transition:"all 0.3s",
              display:"flex", alignItems:"center", gap:8,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#f97316"; e.currentTarget.style.backgroundColor="#fef3e2"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="#f0d9b8"; e.currentTarget.style.backgroundColor="white"; }}>
              🎮 লাইভ ডেমো দেখুন
            </a>
          </div>

          {/* Trust badges */}
          <div style={{ display:"flex", gap:24, justifyContent:"center", flexWrap:"wrap", animation:"fadeUp 0.7s 0.65s ease both" }}>
            {["✓ ৭ দিন ফ্রি ট্রায়াল","✓ ক্রেডিট কার্ড লাগবে না","✓ যেকোনো সময় বাতিল"].map((t,i) => (
              <span key={i} style={{ fontSize:13, color:"#a8896a", fontWeight:500 }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="features" style={{ padding:"100px 24px", backgroundColor:"#fffbf5" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal className="text-center" style={{ textAlign:"center", marginBottom:64 }}>
            <div style={{ textAlign:"center", marginBottom:64 }}>
              <div style={{ fontSize:11, letterSpacing:"0.3em", color:"#f97316", textTransform:"uppercase", fontFamily:"monospace", fontWeight:600, marginBottom:12 }}>// কিভাবে কাজ করে</div>
              <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(32px,5vw,52px)", fontWeight:800, color:"#1a1209", marginBottom:16 }}>
                তিনটি সহজ <span style={{ background:"linear-gradient(135deg, #f97316, #dc2626)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>ধাপ</span>
              </h2>
              <p style={{ fontSize:16, color:"#78614a", maxWidth:400, margin:"0 auto" }}>মিনিটের মধ্যে আপনার রেস্টুরেন্ট ডিজিটাল হয়ে যাক</p>
            </div>
          </Reveal>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:24 }}>
            {[
              { emoji:"📱", step:"০১", title:"QR স্ক্যান করুন", desc:"টেবিলের QR কোড স্ক্যান করলেই মেনু — কোনো অ্যাপ লাগবে না!", accent:"#f97316" },
              { emoji:"🍽️", step:"০২", title:"অর্ডার দিন", desc:"পছন্দের খাবার বেছে নিন, এক ক্লিকে অর্ডার। প্রতিটি সিটে আলাদা অর্ডার!", accent:"#dc2626" },
              { emoji:"⚡", step:"০৩", title:"রিয়েলটাইম আপডেট", desc:"রান্নাঘর সাথে সাথে অর্ডার পায়। স্ট্যাটাস রিয়েলটাইমে ট্র্যাক করুন!", accent:"#059669" },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.12}>
                <div style={{
                  backgroundColor:"white", borderRadius:24, padding:32,
                  border:"1px solid #f0e8d8", position:"relative", overflow:"hidden",
                  transition:"all 0.4s", cursor:"default",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-6px)"; e.currentTarget.style.boxShadow=`0 20px 60px rgba(0,0,0,0.1)`; e.currentTarget.style.borderColor=f.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.borderColor="#f0e8d8"; }}>
                  {/* Step number */}
                  <div style={{
                    position:"absolute", top:20, right:20,
                    width:36, height:36, borderRadius:10,
                    background:`linear-gradient(135deg, ${f.accent}, ${f.accent}cc)`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:800, color:"white", fontFamily:"monospace",
                  }}>{f.step}</div>
                  {/* Emoji */}
                  <div style={{
                    width:72, height:72, borderRadius:20, marginBottom:20,
                    backgroundColor:`${f.accent}10`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:36, border:`1px solid ${f.accent}20`,
                  }}>{f.emoji}</div>
                  <h3 style={{ fontFamily:"'Playfair Display', serif", fontSize:20, fontWeight:700, color:"#1a1209", marginBottom:10 }}>{f.title}</h3>
                  <p style={{ fontSize:14, color:"#78614a", lineHeight:1.7 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section style={{ padding:"100px 24px", backgroundColor:"#ffffff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:64 }}>
              <div style={{ fontSize:11, letterSpacing:"0.3em", color:"#f97316", textTransform:"uppercase", fontFamily:"monospace", fontWeight:600, marginBottom:12 }}>// সুবিধাসমূহ</div>
              <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(32px,5vw,52px)", fontWeight:800, color:"#1a1209" }}>
                সব কিছু <span style={{ background:"linear-gradient(135deg, #f97316, #dc2626)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>এক জায়গায়</span>
              </h2>
            </div>
          </Reveal>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:16 }}>
            {[
              { emoji:"📱", title:"QR ডিজিটাল মেনু", desc:"টেবিলে QR রাখুন — স্ক্যান করলেই সুন্দর মেনু।", color:"#f97316" },
              { emoji:"⚡", title:"রিয়েলটাইম অর্ডার", desc:"অর্ডার হওয়ার সাথে সাথে কিচেনে চলে যায়।", color:"#eab308" },
              { emoji:"🪑", title:"টেবিল ম্যানেজমেন্ট", desc:"কোন টেবিল ফাঁকা, কোনটায় অর্ডার — এক স্ক্রিনে।", color:"#3b82f6" },
              { emoji:"👥", title:"মাল্টি-রোল স্টাফ", desc:"Super Admin, Admin, Waiter — সবার আলাদা dashboard।", color:"#8b5cf6" },
              { emoji:"📊", title:"অ্যানালিটিক্স", desc:"বেস্ট সেলার, রেভিনিউ, পিক আওয়ার — সব data।", color:"#10b981" },
              { emoji:"🏢", title:"মাল্টি-ব্রাঞ্চ", desc:"একাধিক রেস্টুরেন্ট একটি account থেকে পরিচালনা।", color:"#ef4444" },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div style={{
                  padding:"24px 28px", borderRadius:20, backgroundColor:"white",
                  border:"1px solid #f0e8d8", transition:"all 0.3s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor=f.color+"40"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.borderColor="#f0e8d8"; }}>
                  <div style={{ fontSize:32, marginBottom:14, width:52, height:52, borderRadius:14, backgroundColor:f.color+"15", display:"flex", alignItems:"center", justifyContent:"center" }}>{f.emoji}</div>
                  <div style={{ fontFamily:"'Playfair Display', serif", fontWeight:700, fontSize:16, color:"#1a1209", marginBottom:6 }}>{f.title}</div>
                  <div style={{ fontSize:13, color:"#78614a", lineHeight:1.6 }}>{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" style={{ padding:"100px 24px", backgroundColor:"#fffbf5" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:64 }}>
              <div style={{ fontSize:11, letterSpacing:"0.3em", color:"#f97316", textTransform:"uppercase", fontFamily:"monospace", fontWeight:600, marginBottom:12 }}>// মূল্য পরিকল্পনা</div>
              <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(32px,5vw,52px)", fontWeight:800, color:"#1a1209", marginBottom:12 }}>
                সাশ্রয়ী <span style={{ background:"linear-gradient(135deg, #f97316, #dc2626)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>প্রাইসিং</span>
              </h2>
              <p style={{ color:"#78614a", fontSize:16 }}>আপনার রেস্টুরেন্টের আকার অনুযায়ী প্ল্যান বেছে নিন</p>
            </div>
          </Reveal>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:24, alignItems:"stretch" }}>
            {[
              { name:"বেসিক", price:"৩৯৯", desc:"ছোট রেস্টুরেন্টের জন্য পারফেক্ট", features:["৫০টি মেনু আইটেম","৫টি টেবিল","৩ জন স্টাফ","QR অর্ডারিং","রিয়েলটাইম নোটিফিকেশন"], hot:false, delay:0 },
              { name:"প্রিমিয়াম", price:"৬৯৯", desc:"বড় রেস্টুরেন্টের সেরা চয়েস", features:["২০০টি মেনু আইটেম","২০টি টেবিল","১৫ জন স্টাফ","সব বেসিক ফিচার","অ্যানালিটিক্স ড্যাশবোর্ড","প্রায়োরিটি সাপোর্ট"], hot:true, delay:0.1 },
              { name:"এন্টারপ্রাইজ", price:"১,১৯৯", desc:"চেইন রেস্টুরেন্টের জন্য", features:["আনলিমিটেড মেনু","আনলিমিটেড টেবিল","আনলিমিটেড স্টাফ","সব প্রিমিয়াম ফিচার","মাল্টি-ব্রাঞ্চ সাপোর্ট","ডেডিকেটেড সাপোর্ট"], hot:false, delay:0.2 },
            ].map((p, i) => (
              <Reveal key={i} delay={p.delay}>
                <div style={{
                  borderRadius:24, padding:"36px 28px",
                  backgroundColor: p.hot ? "white" : "white",
                  border: p.hot ? "2px solid #f97316" : "1px solid #f0e8d8",
                  boxShadow: p.hot ? "0 20px 60px rgba(249,115,22,0.15)" : "none",
                  position:"relative", display:"flex", flexDirection:"column",
                  transform: p.hot ? "scale(1.03)" : "scale(1)",
                  transition:"all 0.3s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = p.hot ? "scale(1.03) translateY(-4px)" : "translateY(-4px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = p.hot ? "scale(1.03)" : "translateY(0)"; }}>
                  {p.hot && (
                    <div style={{
                      position:"absolute", top:-16, left:"50%", transform:"translateX(-50%)",
                      padding:"6px 20px", borderRadius:100, fontSize:12, fontWeight:700,
                      background:"linear-gradient(135deg, #f97316, #dc2626)", color:"white",
                      boxShadow:"0 4px 14px rgba(249,115,22,0.4)", whiteSpace:"nowrap",
                    }}>🔥 সবচেয়ে জনপ্রিয়</div>
                  )}
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:700, color:"#1a1209", marginBottom:4 }}>{p.name}</div>
                    <div style={{ fontSize:13, color:"#78614a" }}>{p.desc}</div>
                  </div>
                  <div style={{ marginBottom:28 }}>
                    <span style={{ fontSize:14, color:"#78614a", fontWeight:600 }}>৳</span>
                    <span style={{
                      fontSize:52, fontWeight:800, letterSpacing:"-0.03em",
                      fontFamily:"'Playfair Display', serif",
                      background: p.hot ? "linear-gradient(135deg, #f97316, #dc2626)" : "none",
                      WebkitBackgroundClip: p.hot ? "text" : "unset",
                      WebkitTextFillColor: p.hot ? "transparent" : "#1a1209",
                      color: p.hot ? undefined : "#1a1209",
                    }}>{p.price}</span>
                    <span style={{ fontSize:14, color:"#78614a" }}>/মাস</span>
                  </div>
                  <div style={{ borderTop:"1px solid #f0e8d8", paddingTop:24, marginBottom:28, flex:1 }}>
                    {p.features.map((f, fi) => (
                      <div key={fi} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                        <div style={{ width:20, height:20, borderRadius:6, backgroundColor:p.hot ? "#fef3e2" : "#f9f5f0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <span style={{ fontSize:11, color: p.hot ? "#f97316" : "#059669", fontWeight:800 }}>✓</span>
                        </div>
                        <span style={{ fontSize:13, color:"#6b5740" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <a href="/login" style={{
                    display:"block", textAlign:"center", padding:"14px",
                    borderRadius:14, fontSize:15, fontWeight:700, textDecoration:"none",
                    background: p.hot ? "linear-gradient(135deg, #f97316, #dc2626)" : "white",
                    color: p.hot ? "white" : "#92400e",
                    border: p.hot ? "none" : "2px solid #f0d9b8",
                    boxShadow: p.hot ? "0 6px 24px rgba(249,115,22,0.35)" : "none",
                    transition:"all 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity="0.9"; e.currentTarget.style.transform="translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="translateY(0)"; }}>
                    শুরু করুন →
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.4}>
            <p style={{ textAlign:"center", color:"#a8896a", fontSize:14, marginTop:32 }}>
              ✨ সব প্ল্যানে <strong style={{ color:"#1a1209" }}>৭ দিনের ফ্রি ট্রায়াল</strong> — কোনো ক্রেডিট কার্ড লাগবে না
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section style={{ padding:"80px 24px", backgroundColor:"#ffffff" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <Reveal>
            <div style={{
              borderRadius:32, padding:"64px 48px", textAlign:"center", position:"relative", overflow:"hidden",
              background:"linear-gradient(135deg, #1c0d00, #7c2d12, #450a0a)",
            }}>
              {/* Decorative blobs */}
              <div style={{ position:"absolute", top:-40, right:-40, width:200, height:200, borderRadius:"50%", background:"rgba(249,115,22,0.15)", filter:"blur(40px)" }} />
              <div style={{ position:"absolute", bottom:-40, left:-40, width:200, height:200, borderRadius:"50%", background:"rgba(220,38,38,0.15)", filter:"blur(40px)" }} />
              <div style={{ position:"relative", zIndex:1 }}>
                <div style={{ display:"flex", justifyContent:"center", gap:4, marginBottom:16 }}>
                  {[...Array(5)].map((_,i) => <Star key={i} size={18} fill="#fbbf24" color="#fbbf24" />)}
                </div>
                <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(28px,5vw,48px)", fontWeight:800, color:"white", marginBottom:16, lineHeight:1.2 }}>
                  আজই আপনার রেস্টুরেন্ট<br />ডিজিটাল করুন!
                </h2>
                <p style={{ color:"rgba(255,255,255,0.65)", fontSize:16, marginBottom:36, maxWidth:460, margin:"0 auto 36px" }}>
                  ফ্রি ট্রায়ালে সব ফিচার ব্যবহার করুন। কোনো ঝামেলা নেই।
                </p>
                <a href="/login" style={{
                  display:"inline-flex", alignItems:"center", gap:10,
                  padding:"16px 48px", borderRadius:16, fontSize:17, fontWeight:700,
                  color:"#7c2d12", textDecoration:"none", backgroundColor:"white",
                  boxShadow:"0 8px 32px rgba(0,0,0,0.2)",
                  transition:"all 0.3s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px) scale(1.02)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="translateY(0) scale(1)"; }}>
                  ফ্রি ট্রায়াল শুরু করুন <ArrowRight size={18} />
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── NCT BAR ─── */}
      <div style={{ backgroundColor:"#0d0700", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ fontSize:9, letterSpacing:"0.3em", color:"rgba(255,255,255,0.2)", fontFamily:"monospace", textTransform:"uppercase" }}>A Product of</span>
        <a href="https://nexcoreltd.com" target="_blank" rel="noopener noreferrer"
          style={{ fontSize:9, letterSpacing:"0.3em", color:"rgba(34,211,238,0.5)", fontFamily:"monospace", textTransform:"uppercase", textDecoration:"none", transition:"color 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.color="rgba(34,211,238,0.9)"; }}
          onMouseLeave={e => { e.currentTarget.style.color="rgba(34,211,238,0.5)"; }}>
          ⬡ NexCore Technologies Ltd.
        </a>
        <span style={{ fontSize:9, letterSpacing:"0.3em", color:"rgba(255,255,255,0.2)", fontFamily:"monospace", textTransform:"uppercase" }}>· Bangladesh 🇧🇩</span>
      </div>

      {/* ─── FOOTER ─── */}
      <footer style={{ backgroundColor:"#fdf8f0", borderTop:"1px solid #f0e8d8", padding:"48px 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", textAlign:"center" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:20 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg, #f97316, #dc2626)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <UtensilsCrossed size={16} color="white" />
            </div>
            <div style={{ textAlign:"left", lineHeight:1 }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontWeight:700, fontSize:17, color:"#1a1209" }}>Tasty QR Spot</div>
              <div style={{ fontSize:8, letterSpacing:"0.2em", color:"#a8896a", textTransform:"uppercase", fontFamily:"monospace" }}>by NexCore Technologies</div>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:28, flexWrap:"wrap", marginBottom:20 }}>
            {[["ফিচার","#features"],["প্রাইসিং","#pricing"],["ডেমো","/menu/demo"],["লগইন","/login"]].map(([l,h]) => (
              <a key={l} href={h} style={{ fontSize:13, color:"#78614a", textDecoration:"none", transition:"color 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.color="#f97316"; }}
                onMouseLeave={e => { e.currentTarget.style.color="#78614a"; }}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize:12, color:"#a8896a" }}>
            © 2025 Tasty QR Spot — একটি{" "}
            <a href="https://nexcoreltd.com" target="_blank" rel="noopener noreferrer" style={{ color:"#f97316", textDecoration:"none" }}>NexCore Technologies Ltd.</a>{" "}
            পণ্য · সকল অধিকার সংরক্ষিত
          </p>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes floatUp {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
          8%   { opacity: 0.07; }
          92%  { opacity: 0.07; }
          100% { transform: translateY(-110vh) rotate(360deg); opacity: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.3; }
        }
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.8; }
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
      `}</style>
    </div>
  );
}
