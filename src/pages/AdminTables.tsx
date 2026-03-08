import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Plus, Edit, Users, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AdminTables = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [form, setForm] = useState({ name: "", seats: "4" });
  const [showQR, setShowQR] = useState<string | null>(null);

  const { data: tables = [] } = useQuery({
    queryKey: ["tables", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name");
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("No restaurant");
      const payload = { restaurant_id: restaurantId, name: form.name, seats: Number(form.seats) };
      if (editingTable) {
        const { error } = await supabase.from("restaurant_tables").update(payload).eq("id", editingTable.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("restaurant_tables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success(editingTable ? "টেবিল আপডেট হয়েছে" : "টেবিল যোগ হয়েছে");
      setShowForm(false);
      setEditingTable(null);
      setForm({ name: "", seats: "4" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("টেবিল মুছে ফেলা হয়েছে");
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("restaurant_tables").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  const menuUrl = (tableId: string) => `${window.location.origin}/menu/${restaurantId}?table=${tableId}`;

  return (
    <DashboardLayout role="admin" title="টেবিল ও QR কোড ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-success" /><span className="text-sm text-muted-foreground">ফাঁকা</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary" /><span className="text-sm text-muted-foreground">ব্যস্ত</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-warning" /><span className="text-sm text-muted-foreground">রিজার্ভড</span></div>
          </div>
          <Button variant="hero" onClick={() => { setForm({ name: "", seats: "4" }); setEditingTable(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> টেবিল যোগ করুন
          </Button>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingTable ? "টেবিল সম্পাদনা" : "নতুন টেবিল"}</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div><Label>টেবিল নাম</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="T-1" required /></div>
              <div><Label>সিট সংখ্যা</Label><Input type="number" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} required /></div>
              <Button type="submit" variant="hero" className="w-full" disabled={saveMutation.isPending}>সেভ করুন</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* QR Dialog */}
        <Dialog open={!!showQR} onOpenChange={() => setShowQR(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">QR কোড লিংক</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">এই লিংকটি QR কোড হিসেবে প্রিন্ট করুন:</p>
              <code className="block p-3 bg-secondary rounded-lg text-xs break-all">{showQR}</code>
              <Button variant="hero" className="w-full" onClick={() => { navigator.clipboard.writeText(showQR!); toast.success("কপি করা হয়েছে!"); }}>
                লিংক কপি করুন
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {tables.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">কোনো টেবিল নেই। "টেবিল যোগ করুন" বাটনে ক্লিক করুন।</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {tables.map((table: any) => (
              <Card key={table.id} className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer ${
                table.status === "occupied" ? "border-primary/30" : table.status === "reserved" ? "border-warning/30" : "border-success/30"
              }`}>
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  table.status === "occupied" ? "gradient-primary" : table.status === "reserved" ? "bg-warning" : "bg-success"
                }`} />
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
                    table.status === "occupied" ? "bg-primary/10" : table.status === "reserved" ? "bg-warning/10" : "bg-success/10"
                  }`}>
                    <span className="text-2xl font-display font-bold text-foreground">{table.name}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-3">
                    <Users className="w-4 h-4" /><span>{table.seats} সিট</span>
                  </div>
                  <select
                    value={table.status}
                    onChange={e => toggleStatus.mutate({ id: table.id, status: e.target.value })}
                    className="w-full mb-3 h-8 rounded border border-border bg-background text-xs px-2"
                  >
                    <option value="available">ফাঁকা</option>
                    <option value="occupied">ব্যস্ত</option>
                    <option value="reserved">রিজার্ভড</option>
                  </select>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={() => setShowQR(menuUrl(table.id))}>
                      <QrCode className="w-3 h-3" /> QR
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setForm({ name: table.name, seats: String(table.seats) }); setEditingTable(table); setShowForm(true); }}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(table.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminTables;
