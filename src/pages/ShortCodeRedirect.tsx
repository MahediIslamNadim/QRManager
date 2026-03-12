import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ShortCodeRedirect = () => {
  const { shortCode } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const lookup = async () => {
      if (!shortCode) { setError(true); return; }
      const { data } = await (supabase
        .from("restaurants")
        .select("id") as any)
        .eq("short_code", shortCode)
        .single();
      if (data) {
        navigate(`/menu/${data.id}`, { replace: true });
      } else {
        setError(true);
      }
    };
    lookup();
  }, [shortCode, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-4xl">😕</p>
          <h1 className="text-xl font-display font-bold text-foreground">রেস্টুরেন্ট পাওয়া যায়নি</h1>
          <p className="text-muted-foreground text-sm">এই QR কোডটি সঠিক নয় অথবা মেয়াদ শেষ হয়েছে।</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default ShortCodeRedirect;
