import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const WaiterSeats = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["waiter-tables-seats", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("restaurant_tables")
        .select("id, name, seats, status, current_customers")
        .eq("restaurant_id", restaurantId)
        .order("name");
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const { data: seats = [] } = useQuery({
    queryKey: ["waiter-seats-list", restaurantId, selectedTable],
    queryFn: async () => {
      if (!restaurantId || !selectedTable) return [];
      const { data } = await supabase
        .from("table_seats")
        .select("*")
        .eq("table_id", selectedTable)
        .order("seat_number");
      return data || [];
    },
    enabled: !!restaurantId && !!selectedTable,
  });

  // ✅ FIX Bug 6: seat update হলে table এর current_customers ও sync করো
  const updateSeatStatus = async (seatId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("table_seats")
        .update({ status: newStatus })
        .eq("id", seatId);
      if (error) throw error;

      // ✅ seat occupied/available count থেকে current_customers update করো
      if (selectedTable) {
        const { data: allSeats } = await supabase
          .from("table_seats")
          .select("status")
          .eq("table_id", selectedTable);

        if (allSeats) {
          // DB already updated, so allSeats reflects the new status
          const updatedCount = allSeats.filter(s => s.status === "occupied").length;

          await supabase
            .from("restaurant_tables")
            .update({ current_customers: updatedCount })
            .eq("id", selectedTable);
        }
      }

      // দুটো query ই invalidate করো
      queryClient.invalidateQueries({ queryKey: ["waiter-seats-list"] });
      queryClient.invalidateQueries({ queryKey: ["waiter-tables-seats", restaurantId] });
    } catch (err: any) {
      toast.error("সিট আপডেট ব্যর্থ: " + err.message);
    }
  };

  const selectedTableData = tables.find((t: any) => t.id === selectedTable);
  const occupiedCount = seats.filter((s: any) => s.status === "occupied").length;
  const availableCount = seats.filter((s: any) => s.status !== "occupied").length;

  return (
    <DashboardLayout role="waiter" title="সিট ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-1">সিট রিকোয়েস্ট</h2>
          <p className="text-muted-foreground text-sm">টেবিলের সিট স্ট্যাটাস ম্যানেজ করুন</p>
        </div>

        {/* Table Grid */}
        <div>
          <h3 className="text-lg font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> টেবিল নির্বাচন করুন
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {isLoading && <p className="text-muted-foreground col-span-full text-center py-4">লোড হচ্ছে...</p>}
            {tables.map((table: any) => {
              const isSelected = selectedTable === table.id;
              const hasCustomers = (table.current_customers || 0) > 0;
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table.id)}
                  className={`rounded-xl border p-3 text-center transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : hasCustomers
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/40 bg-secondary/30"
                  }`}
                >
                  <p className="font-display font-bold text-foreground text-sm">{table.name}</p>
                  <p className={`text-lg font-bold ${hasCustomers ? "text-primary" : "text-muted-foreground"}`}>
                    👤 {table.current_customers || 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{table.seats} সিট</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Seats for selected table */}
        {selectedTable && (
          <div>
            <h3 className="text-lg font-display font-semibold text-foreground mb-1 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              সিট তালিকা — {selectedTableData?.name}
            </h3>
            {/* ✅ FIX Bug 6: seat count summary দেখাও */}
            {seats.length > 0 && (
              <div className="flex gap-3 mb-3">
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                  ব্যস্ত: {occupiedCount}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-semibold">
                  খালি: {availableCount}
                </span>
              </div>
            )}
            {seats.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  এই টেবিলে কোনো সিট কনফিগার করা হয়নি
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {seats.map((seat: any) => (
                  <Card key={seat.id} className={`transition-all ${seat.status === "occupied" ? "border-primary/40" : ""}`}>
                    <CardContent className="p-4 text-center">
                      <p className="font-display font-bold text-foreground mb-1">সিট {seat.seat_number}</p>
                      <Badge
                        variant={seat.status === "occupied" ? "default" : "secondary"}
                        className="mb-3"
                      >
                        {seat.status === "occupied" ? "ব্যস্ত" : "খালি"}
                      </Badge>
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant={seat.status === "available" ? "hero" : "outline"}
                          onClick={() => updateSeatStatus(
                            seat.id,
                            seat.status === "occupied" ? "available" : "occupied"
                          )}
                        >
                          {seat.status === "occupied" ? "খালি করুন" : "বসান"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WaiterSeats;
