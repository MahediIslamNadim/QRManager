import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { UtensilsCrossed, Users, Armchair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CustomerSeatSelect = () => {
  const { restaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table");
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [tableName, setTableName] = useState("");
  const [seats, setSeats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!restaurantId || !tableId) return;

      const [restRes, tableRes, seatsRes] = await Promise.all([
        supabase.from("restaurants").select("name").eq("id", restaurantId).single(),
        supabase.from("restaurant_tables").select("name, seats").eq("id", tableId).single(),
        supabase.from("table_seats").select("*").eq("table_id", tableId).order("seat_number"),
      ]);

      if (restRes.data) setRestaurant(restRes.data);
      if (tableRes.data) setTableName(tableRes.data.name);
      if (seatsRes.data) setSeats(seatsRes.data);
      setLoading(false);
    };
    fetchData();
  }, [restaurantId, tableId]);

  const selectSeat = (seatId: string) => {
    navigate(`/menu/${restaurantId}?table=${tableId}&seat=${seatId}`);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/20">
      {/* Header */}
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

      {/* Seat Selection */}
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
