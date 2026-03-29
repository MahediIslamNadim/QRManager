import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, UtensilsCrossed, ArrowRight, KeyRound, CheckCircle } from "lucide-react";
import { APP_NAME, COMPANY_NAME } from "@/constants/app";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check existing session on mount (user already has recovery token)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setValidSession(true);
        setChecking(false);
      }
    });

    // Listen for PASSWORD_RECOVERY event (fired when coming from email link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidSession(true);
      }
      setChecking(false);
    });

    // Fallback: stop spinner after 3s if no event fires
    const timeout = setTimeout(() => setChecking(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"); return; }
    if (password !== confirmPassword) { toast.error("পাসওয়ার্ড দুটো মিলছে না!"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      toast.error(err.message || "সমস্যা হয়েছে, আবার চেষ্টা করুন");
    } finally {
      setSubmitting(false);
    }
  };

  const gold = "linear-gradient(135deg, #f5d780, #c9a84c, #e8c04a)";

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 48,
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(201,168,76,0.2)",
    borderRadius: 12, padding: "0 48px 0 16px",
    fontSize: 14, color: "#FFFFFF", outline: "none",
    transition: "border-color 0.2s, background-color 0.2s",
    fontFamily: "'DM Sans', sans-serif",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 6, display: "block",
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "0.04em", textTransform: "uppercase",
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: "24px" }}>

      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 65%)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40, justifyContent: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: gold, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(201,168,76,0.3)" }}>
            <UtensilsCrossed size={20} color="#0a0a0a" />
          </div>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>{APP_NAME}</div>
            <div style={{ fontSize: 9, letterSpacing: "0.28em", color: "rgba(201,168,76,0.55)", textTransform: "uppercase", fontFamily: "monospace" }}>by {COMPANY_NAME.replace(" Ltd.", "")}</div>
          </div>
        </div>

        {/* Loading */}
        {checking ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
            <div style={{ width: 24, height: 24, border: "2px solid rgba(201,168,76,0.3)", borderTopColor: "#f5d780", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
            যাচাই করা হচ্ছে...
          </div>

        /* ✅ Success screen */
        ) : done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(134,239,172,0.1)", border: "1px solid rgba(134,239,172,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <CheckCircle size={32} color="#86efac" />
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: "#FFFFFF", marginBottom: 12 }}>পাসওয়ার্ড পরিবর্তন হয়েছে!</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>৩ সেকেন্ডের মধ্যে লগইন পেজে নিয়ে যাওয়া হবে...</p>
            <button onClick={() => navigate("/login")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#f5d780", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>
              এখনই লগইন করুন →
            </button>
          </div>

        /* ❌ Invalid/expired token */
        ) : !validSession ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <KeyRound size={32} color="#f87171" />
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 700, color: "#FFFFFF", marginBottom: 12 }}>লিংক মেয়াদ শেষ!</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 28 }}>
              এই রিসেট লিংকটি expired বা ইতিমধ্যে ব্যবহার করা হয়েছে।<br />
              নতুন লিংকের জন্য আবার চেষ্টা করুন।
            </p>
            <button onClick={() => navigate("/login")}
              style={{ padding: "12px 28px", borderRadius: 10, background: gold, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#0a0a0a", fontFamily: "'DM Sans', sans-serif" }}>
              লগইন পেজে যান
            </button>
          </div>

        /* ✅ Reset password form */
        ) : (
          <div>
            <div style={{ marginBottom: 32 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <KeyRound size={24} color="#f5d780" />
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>নতুন পাসওয়ার্ড দিন</h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>শক্তিশালী পাসওয়ার্ড ব্যবহার করুন — কমপক্ষে ৬ অক্ষর।</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* New password */}
                <div>
                  <label style={labelStyle}>নতুন পাসওয়ার্ড</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={inputStyle} required minLength={6}
                      onFocus={e => { e.target.style.borderColor = "rgba(201,168,76,0.6)"; e.target.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(201,168,76,0.2)"; e.target.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", padding: 0 }}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {/* Password strength indicator */}
                  {password.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 3, borderRadius: 2,
                          backgroundColor: password.length >= i * 2
                            ? i <= 1 ? "#f87171" : i <= 2 ? "#fbbf24" : i <= 3 ? "#86efac" : "#4ade80"
                            : "rgba(255,255,255,0.1)",
                          transition: "background-color 0.2s",
                        }} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label style={labelStyle}>পাসওয়ার্ড নিশ্চিত করুন</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{
                        ...inputStyle,
                        borderColor: confirmPassword && confirmPassword !== password
                          ? "rgba(248,113,113,0.5)"
                          : confirmPassword && confirmPassword === password
                          ? "rgba(134,239,172,0.5)"
                          : "rgba(201,168,76,0.2)",
                      }} required
                      onFocus={e => { e.target.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                      onBlur={e => { e.target.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", padding: 0 }}>
                      {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>⚠ পাসওয়ার্ড দুটো মিলছে না</p>
                  )}
                  {confirmPassword && confirmPassword === password && (
                    <p style={{ fontSize: 12, color: "#86efac", marginTop: 6 }}>✓ পাসওয়ার্ড মিলেছে</p>
                  )}
                </div>

                {/* Submit */}
                <button type="submit" disabled={submitting}
                  style={{
                    width: "100%", height: 52, borderRadius: 12,
                    background: submitting ? "rgba(201,168,76,0.4)" : gold,
                    border: "none", cursor: submitting ? "not-allowed" : "pointer",
                    fontSize: 15, fontWeight: 700, color: "#0a0a0a",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: submitting ? "none" : "0 8px 32px rgba(201,168,76,0.3)",
                    transition: "all 0.25s",
                  }}
                  onMouseEnter={e => { if (!submitting) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(201,168,76,0.45)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(201,168,76,0.3)"; }}>
                  {submitting ? (
                    <><span style={{ width: 16, height: 16, border: "2px solid rgba(10,10,10,0.3)", borderTopColor: "#0a0a0a", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> অপেক্ষা করুন...</>
                  ) : (
                    <>পাসওয়ার্ড পরিবর্তন করুন <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 40, letterSpacing: "0.03em" }}>
          © {new Date().getFullYear()} {APP_NAME} · <span style={{ color: "rgba(201,168,76,0.4)" }}>{COMPANY_NAME}</span>
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #111 inset !important; -webkit-text-fill-color: #fff !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ResetPassword;
