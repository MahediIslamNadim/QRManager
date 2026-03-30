import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { UtensilsCrossed, Users, Armchair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CustomerSeatSelect = () => {
  const { restaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table");
  const tokenParam = searchParams.get("token"); // ✅ token from URL
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [tableName, setTableName] = useState("");
  const [seats, setSeats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validToken, setValidToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!restaurantId || !tableId) { setError("ভুল লিংক"); setLoading(false); return; }

      try {
      const [restRes, tableRes, seatsRes] = await Promise.all([
        supabase.from("restaurants").select("name").eq("id", restaurantId).maybeSingle(),
        supabase.from("restaurant_tables").select("name, seats").eq("id", tableId).maybeSingle(),
        supabase.from("table_seats").select("*").eq("table_id", tableId).order("seat_number"),
      ]);

      if (restRes.data) setRestaurant(restRes.data);
      if (tableRes.data) setTableName(tableRes.data.name);
      if (seatsRes.data) setSeats(seatsRes.data);

      // ✅ Find valid token for this table
      // First check URL token
      if (tokenParam) {
        const { data: session } = await supabase
          .from("table_sessions" as any)
          .select("token, expires_at")
          .eq("token", tokenParam)
          .eq("table_id", tableId)
          .maybeSingle();
        if (session && new Date((session as any).expires_at) > new Date()) {
          setValidToken((session as any).token);
          setLoading(false);
          return;
        }
      }

      // Fallback: find any valid session for this table
      const { data: existingSession } = await supabase
        .from("table_sessions" as any)
        .select("token, expires_at")
        .eq("table_id", tableId)
        .eq("restaurant_id", restaurantId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        setValidToken((existingSession as any).token);
      }

      setLoading(false);
      } catch (err) {
        setError("তথ্য লোড করতে সমস্যা হয়েছে। পেজ রিফ্রেশ করুন।");
        setLoading(false);
      }
    };
    fetchData();
  }, [restaurantId, tableId, tokenParam]);

  // Realtime seat status updates
  useEffect(() => {
    if (!tableId) return;
    const channel = supabase
      .channel(`seat-status-${tableId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "table_seats",
        filter: `table_id=eq.${tableId}`
      }, (payload) => {
        setSeats(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s));
        if (payload.new.status === "occupied" && payload.old?.status === "available") {
          toast.info(`সিট ${payload.new.seat_number} এইমাত্র ব্যস্ত হয়েছে`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId]);

  // ✅ Pass token when navigating to menu
  const selectSeat = (seatId: string) => {
    const tokenQuery = validToken ? `&token=${validToken}` : "";
    navigate(`/menu/${restaurantId}?table=${tableId}&seat=${seatId}${tokenQuery}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-6">
          <p className="text-destructive font-medium mb-3">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">রিফ্রেশ করুন</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/20">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-2xl border-b border-border/50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-lg leading-tight">
              {restaurant?.name || "Restaurant"}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              টেবিল {tableName}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">আপনার সিট নির্বাচন করুন</h2>
          <p className="text-muted-foreground text-sm">
            টেবিল {tableName} — অর্ডার করতে আপনার সিট সিলেক্ট করুন
          </p>
        </div>

        {seats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">এই টেবিলে কোনো সিট কনফিগার করা হয়নি</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {seats.map((seat) => {
              const isOccupied = seat.status === "occupied";
              return (
                <button
                  key={seat.id}
                  onClick={() => !isOccupied && selectSeat(seat.id)}
                  disabled={isOccupied}
                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-3 ${
                    isOccupied
                      ? "border-destructive/30 bg-destructive/5 opacity-60 cursor-not-allowed"
                      : "border-primary/30 bg-card hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 active:scale-95 cursor-pointer"
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    isOccupied ? "bg-destructive/10" : "bg-primary/10"
                  }`}>
                    <Armchair className={`w-7 h-7 ${isOccupied ? "text-destructive" : "text-primary"}`} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-foreground text-lg">সিট {seat.seat_number}</p>
                    <p className={`text-xs font-medium ${isOccupied ? "text-destructive" : "text-success"}`}>
                      {isOccupied ? "ব্যস্ত" : "খালি আছে"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSeatSelect;
