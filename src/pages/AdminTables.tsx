import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Plus, Edit, Users, Trash2, ShoppingCart, UserPlus, UserMinus, Armchair, LockOpen, Lock, Download, Printer, Share2, Copy } from "lucide-react";
import SeatManagement from "@/components/SeatManagement";
import { useAuth } from "@/hooks/useAuth";
import { useCanCreateTable } from "@/hooks/useTableLimit";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QRCodeLib from "qrcode";

const AdminTables = () => {
  const { restaurantId } = useAuth();
  const navigate = useNavigate();
  
  // ✅ New tier-based table limit system
  const { 
    canAdd: canAddTable, 
    currentCount: tableCount, 
    maxTables, 
    tier,
    isAtLimit: isAtTableLimit, 
    upgradeMessage,
    loading: limitLoading,
    checkBeforeCreate 
  } = useCanCreateTable(restaurantId);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [form, setForm] = useState({ name: "", seats: "4" });
  const [showQR, setShowQR] = useState<string | null>(null);
  const [qrType, setQrType] = useState<"table" | "seat" | null>(null);
  const [qrLabel, setQrLabel] = useState("");
  const [qrSublabel, setQrSublabel] = useState("");
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [seatTable, setSeatTable] = useState<any>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // ✅ Fetch restaurant short_code for QR URLs
  const { data: restaurant } = useQuery({
    queryKey: ["restaurant-short", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, short_code")
        .eq("id", restaurantId)
        .maybeSingle();
      if (error) { console.warn("Restaurant fetch error:", error.message); return null; }
      return data;
    },
    enabled: !!restaurantId,
  });

  const { data: allSeats = [] } = useQuery({
    queryKey: ["all-seats", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("table_seats")
        .select("*")
        .eq("restaurant_id", restaurantId);
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const { data: tableOrders = {} } = useQuery({
    queryKey: ["table-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return {};
      const { data } = await supabase
        .from("orders")
        .select("id, table_id, total, status, created_at, order_items(name, quantity, price)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "preparing", "served"])
        .order("created_at", { ascending: false });
      const map: Record<string, any[]> = {};
      (data || []).forEach((o: any) => {
        if (o.table_id) {
          if (!map[o.table_id]) map[o.table_id] = [];
          map[o.table_id].push(o);
        }
      });
      return map;
    },
    enabled: !!restaurantId,
  });

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`admin-tables-realtime-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["table-orders", restaurantId] });
        queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "table_seats" }, () => {
        queryClient.invalidateQueries({ queryKey: ["all-seats", restaurantId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, queryClient]);

  // isAtTableLimit is now from useCanCreateTable hook

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("No restaurant");
      const payload = { restaurant_id: restaurantId, name: form.name, seats: Number(form.seats) };
      // ✅ Check table limit before creating
      if (!editingTable) {
        const check = checkBeforeCreate();
        if (!check.allowed) {
          throw new Error(upgradeMessage || 'Table limit reached. Please upgrade to add more tables.');
        }
      }
      if (editingTable) {
        const { error } = await supabase.from("restaurant_tables").update(payload).eq("id", editingTable.id).eq("restaurant_id", restaurantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("restaurant_tables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
      toast.success(editingTable ? "টেবিল আপডেট হয়েছে" : "টেবিল যোগ হয়েছে");
      setShowForm(false);
      setEditingTable(null);
      setForm({ name: "", seats: "4" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurant_tables").delete().eq("id", id).eq("restaurant_id", restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
      toast.success("টেবিল মুছে ফেলা হয়েছে");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("restaurant_tables").update({ status }).eq("id", id).eq("restaurant_id", restaurantId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] }),
    onError: (err: any) => toast.error(err.message),
  });

  // ✅ Toggle table open/close
  const toggleOpen = useMutation({
    mutationFn: async ({ id, is_open }: { id: string; is_open: boolean }) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ is_open } as any)
        .eq("id", id)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
      toast.success(vars.is_open ? "টেবিল খোলা হয়েছে ✅" : "টেবিল বন্ধ করা হয়েছে 🔒");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ✅ QR URLs — use short_code if available, fallback to restaurantId
  const baseMenuUrl = (tableId: string) => {
    const base = restaurant?.short_code
      ? `${window.location.origin}/r/${restaurant.short_code}`
      : `${window.location.origin}/menu/${restaurantId}`;
    return `${base}?table=${tableId}`;
  };

  const seatUrl = (tableId: string, seatId: string) => {
    const base = restaurant?.short_code
      ? `${window.location.origin}/r/${restaurant.short_code}`
      : `${window.location.origin}/menu/${restaurantId}`;
    return `${base}?table=${tableId}&seat=${seatId}`;
  };

  // Draw QR code onto canvas with label
  const drawQR = useCallback(async (canvas: HTMLCanvasElement, url: string, label: string, sublabel: string) => {
    const qrSize = 240;
    const pad = 20;
    const bottomH = sublabel ? 72 : 52;
    canvas.width  = qrSize + pad * 2;
    canvas.height = qrSize + pad * 2 + bottomH;
    const ctx = canvas.getContext("2d")!;

    // White background with rounded feel
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // QR code onto temp canvas then blit
    const tmp = document.createElement("canvas");
    await QRCodeLib.toCanvas(tmp, url, { width: qrSize, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
    ctx.drawImage(tmp, pad, pad);

    // Divider line
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, qrSize + pad + 10);
    ctx.lineTo(canvas.width - pad, qrSize + pad + 10);
    ctx.stroke();

    // Label text
    ctx.textAlign = "center";
    ctx.fillStyle = "#111827";
    if (sublabel) {
      ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
      ctx.fillText(label, canvas.width / 2, qrSize + pad + 30);
      ctx.font = "13px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(sublabel, canvas.width / 2, qrSize + pad + 50);
    } else {
      ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
      ctx.fillText(label, canvas.width / 2, qrSize + pad + 34);
    }
  }, []);

  // Callback ref: fires when canvas mounts (after Dialog animation), avoids null-ref timing issue
  const qrCanvasCallback = useCallback((canvas: HTMLCanvasElement | null) => {
    qrCanvasRef.current = canvas;
    if (canvas && showQR) drawQR(canvas, showQR, qrLabel, qrSublabel);
  }, [showQR, qrLabel, qrSublabel, drawQR]);

  const handleQRDownload = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `qr-${qrLabel.replace(/\s+/g, "-")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
    toast.success("QR কোড ডাউনলোড হয়েছে!");
  };

  const handleQRPrint = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const img = canvas.toDataURL("image/png");
    const w = window.open("", "_blank")!;
    w.document.write(`<html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">
      <div style="text-align:center"><img src="${img}" style="max-width:320px"/></div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const handleQRShare = async () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    if (navigator.share) {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.share({
            title: `QR — ${qrLabel}`,
            files: [new File([blob], `qr-${qrLabel}.png`, { type: "image/png" })],
          });
        } catch {
          navigator.clipboard.writeText(showQR!);
          toast.success("লিংক কপি করা হয়েছে!");
        }
      }, "image/png");
    } else {
      navigator.clipboard.writeText(showQR!);
      toast.success("লিংক কপি করা হয়েছে!");
    }
  };

  const getTableColor = (table: any) => {
    const orders = tableOrders[table.id];
    if (orders && orders.length > 0) {
      const hasPending = orders.some((o: any) => o.status === "pending");
      const hasPreparing = orders.some((o: any) => o.status === "preparing");
      if (hasPending) return { border: "border-destructive/50", bar: "bg-destructive", bg: "bg-destructive/10", label: "নতুন অর্ডার", dot: "bg-destructive" };
      if (hasPreparing) return { border: "border-warning/50", bar: "bg-warning", bg: "bg-warning/10", label: "প্রস্তুত হচ্ছে", dot: "bg-warning" };
      return { border: "border-primary/50", bar: "gradient-primary", bg: "bg-primary/10", label: "সার্ভ হচ্ছে", dot: "bg-primary" };
    }
    if (table.status === "occupied") return { border: "border-primary/30", bar: "gradient-primary", bg: "bg-primary/10", label: "ব্যস্ত", dot: "bg-primary" };
    if (table.status === "reserved") return { border: "border-warning/30", bar: "bg-warning", bg: "bg-warning/10", label: "রিজার্ভড", dot: "bg-warning" };
    return { border: "border-success/30", bar: "bg-success", bg: "bg-success/10", label: "ফাঁকা", dot: "bg-success" };
  };

  return (
    <DashboardLayout role="admin" title="টেবিল ও QR কোড ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-success" /><span className="text-sm text-muted-foreground">ফাঁকা</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-destructive" /><span className="text-sm text-muted-foreground">নতুন অর্ডার</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-warning" /><span className="text-sm text-muted-foreground">প্রস্তুত হচ্ছে</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary" /><span className="text-sm text-muted-foreground">সার্ভ/ব্যস্ত</span></div>
            {/* ✅ Open/Close legend */}
            <div className="flex items-center gap-2"><LockOpen className="w-3.5 h-3.5 text-success" /><span className="text-sm text-muted-foreground">অর্ডার খোলা</span></div>
            <div className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-destructive" /><span className="text-sm text-muted-foreground">অর্ডার বন্ধ</span></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
              {tableCount}/{maxTables} টেবিল
            </span>
            <Button variant="hero" onClick={() => { setForm({ name: "", seats: "4" }); setEditingTable(null); setShowForm(true); }} disabled={!canAddTable || limitLoading}>
              <Plus className="w-4 h-4" /> টেবিল যোগ করুন
            </Button>
          </div>
        </div>

        {isAtTableLimit && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-warning text-lg">⚠️</span>
              <span className="font-semibold text-warning">টেবিল সীমা পূর্ণ হয়েছে!</span>
            </div>
            <p className="text-muted-foreground mb-3">
              {upgradeMessage || `আপনার বর্তমান প্ল্যানে সর্বোচ্চ ${maxTables}টি টেবিল যোগ করা যাবে।`}
            </p>
            {tier === 'medium_smart' && (
              <Button
                variant="default"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => navigate('/upgrade')}
              >
                হাই স্মার্টে আপগ্রেড করুন → আনলিমিটেড টেবিল
              </Button>
            )}
          </div>
        )}

        {/* Add/Edit Table Dialog */}
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
        <Dialog open={!!showQR} onOpenChange={() => { setShowQR(null); setQrType(null); setQrLabel(""); setQrSublabel(""); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                {qrLabel}{qrSublabel ? ` — ${qrSublabel}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Type badge */}
              <div className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                qrType === "seat"
                  ? "bg-info/10 border border-info/30 text-info"
                  : "bg-success/10 border border-success/30 text-success"
              }`}>
                {qrType === "seat" ? "🪑 সিট QR — সরাসরি মেনুতে যাবে" : "👥 টেবিল QR — Seat Select করতে হবে"}
              </div>

              {/* QR Canvas */}
              <div className="flex justify-center">
                <canvas
                  ref={qrCanvasCallback}
                  className="rounded-2xl border border-border shadow-md"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              </div>

              {/* URL (collapsible) */}
              <details className="group">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                  🔗 লিংক দেখুন
                </summary>
                <code className="block mt-2 p-2.5 bg-secondary rounded-lg text-[11px] break-all text-foreground">{showQR}</code>
              </details>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="hero" className="h-11" onClick={handleQRDownload}>
                  <Download className="w-4 h-4 mr-1.5" /> ডাউনলোড
                </Button>
                <Button variant="outline" className="h-11" onClick={handleQRPrint}>
                  <Printer className="w-4 h-4 mr-1.5" /> প্রিন্ট
                </Button>
                <Button variant="outline" className="h-11" onClick={handleQRShare}>
                  <Share2 className="w-4 h-4 mr-1.5" /> শেয়ার
                </Button>
                <Button variant="outline" className="h-11" onClick={() => { navigator.clipboard.writeText(showQR!); toast.success("লিংক কপি হয়েছে!"); }}>
                  <Copy className="w-4 h-4 mr-1.5" /> কপি লিংক
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Table Order Detail Dialog */}
        <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-display">টেবিল {selectedTable?.name} — অর্ডার</DialogTitle></DialogHeader>
            {selectedTable && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {(tableOrders[selectedTable.id] || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">কোনো অ্যাক্টিভ অর্ডার নেই</p>
                ) : (
                  (tableOrders[selectedTable.id] || []).map((order: any) => (
                    <div key={order.id} className="p-3 rounded-xl bg-secondary/50 border border-border/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-foreground text-sm">#{order.id.slice(0, 6)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.status === "pending" ? "bg-destructive/10 text-destructive" :
                          order.status === "preparing" ? "bg-warning/10 text-warning" :
                          "bg-success/10 text-success"
                        }`}>{order.status === "pending" ? "পেন্ডিং" : order.status === "preparing" ? "প্রস্তুত হচ্ছে" : "সার্ভ"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {order.order_items?.map((item: any, i: number) => (
                          <span key={i} className="text-xs px-2 py-1 rounded bg-accent text-accent-foreground">
                            {item.name} x{item.quantity}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm font-bold text-foreground mt-2">৳{order.total}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {tables.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">কোনো টেবিল নেই। "টেবিল যোগ করুন" বাটনে ক্লিক করুন।</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {tables.map((table: any) => {
              const color = getTableColor(table);
              const orders = tableOrders[table.id] || [];
              const orderCount = orders.length;
              const totalAmount = orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
              // ✅ is_open — treat undefined as true (backward compat)
              const isOpen = (table as any).is_open !== false;

              return (
                <Card
                  key={table.id}
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer ${color.border} ${!isOpen ? "opacity-75" : ""}`}
                  onClick={() => orderCount > 0 && setSelectedTable(table)}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${color.bar}`} />
                  {orders.some((o: any) => o.status === "pending") && (
                    <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-destructive animate-ping" />
                  )}

                  {/* ✅ Closed badge */}
                  {!isOpen && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 border border-destructive/30 z-10">
                      <Lock className="w-2.5 h-2.5 text-destructive" />
                      <span className="text-[10px] font-bold text-destructive">বন্ধ</span>
                    </div>
                  )}

                  <CardContent className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center ${color.bg}`}>
                      <span className="text-2xl font-display font-bold text-foreground">{table.name}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                      <span className="text-xs font-medium text-muted-foreground">{color.label}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mb-1">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{table.seats} সিট</span>
                      <span className="flex items-center gap-1 font-semibold text-foreground">👤 {table.current_customers || 0} জন</span>
                    </div>

                    {/* Customer count controls */}
                    <div className="flex items-center justify-center gap-2 mb-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          const nc = Math.max(0, (table.current_customers || 0) - 1);
                          Promise.resolve(supabase.from("restaurant_tables").update({ current_customers: nc }).eq("id", table.id).eq("restaurant_id", restaurantId))
                            .then(({ error }) => { if (!error) queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] }); else toast.error("আপডেট ব্যর্থ: " + error.message); })
                            .catch((e: any) => toast.error("আপডেট ব্যর্থ: " + e.message));
                        }}
                        className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition-all"
                      >
                        <UserMinus className="w-3.5 h-3.5 text-destructive" />
                      </button>
                      <span className="text-sm font-bold text-foreground w-6 text-center">{table.current_customers || 0}</span>
                      <button
                        onClick={() => {
                          const nc = Math.min(table.seats, (table.current_customers || 0) + 1);
                          Promise.resolve(supabase.from("restaurant_tables").update({ current_customers: nc }).eq("id", table.id).eq("restaurant_id", restaurantId))
                            .then(({ error }) => { if (!error) queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] }); else toast.error("আপডেট ব্যর্থ: " + error.message); })
                            .catch((e: any) => toast.error("আপডেট ব্যর্থ: " + e.message));
                        }}
                        className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-all"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Seat info */}
                    {(() => {
                      const tableSeats = allSeats.filter((s: any) => s.table_id === table.id);
                      if (tableSeats.length > 0) {
                        const occupied = tableSeats.filter((s: any) => s.status === "occupied").length;
                        const available = tableSeats.filter((s: any) => s.status === "available").length;
                        return (
                          <>
                            <div className="flex items-center justify-center gap-1.5 text-xs mb-1" onClick={e => e.stopPropagation()}>
                              <Armchair className="w-3 h-3 text-muted-foreground" />
                              <span className="text-success font-medium">{available} ফাঁকা</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-destructive font-medium">{occupied} ব্যস্ত</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-1 mb-1" onClick={e => e.stopPropagation()}>
                              {tableSeats.map((seat: any) => (
                                <button key={seat.id} onClick={() => {
                                  setShowQR(seatUrl(table.id, seat.id));
                                  setQrType("seat");
                                  setQrLabel(table.name);
                                  setQrSublabel(`সিট ${seat.seat_number}`);
                                }}
                                  className="text-[10px] px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors">
                                  🪑 সিট {seat.seat_number} QR
                                </button>
                              ))}
                            </div>
                          </>
                        );
                      }
                      return null;
                    })()}

                    {orderCount > 0 && (
                      <div className="flex items-center justify-center gap-1 text-xs text-primary font-medium mb-2">
                        <ShoppingCart className="w-3 h-3" /> {orderCount} অর্ডার • ৳{totalAmount}
                      </div>
                    )}

                    <select
                      value={table.status}
                      onChange={e => { e.stopPropagation(); toggleStatus.mutate({ id: table.id, status: e.target.value }); }}
                      onClick={e => e.stopPropagation()}
                      className="w-full mb-2 h-8 rounded border border-border bg-background text-xs px-2"
                    >
                      <option value="available">ফাঁকা</option>
                      <option value="occupied">ব্যস্ত</option>
                      <option value="reserved">রিজার্ভড</option>
                    </select>

                    {/* ✅ Open/Close toggle button */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleOpen.mutate({ id: table.id, is_open: !isOpen }); }}
                      className={`w-full mb-3 h-8 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border ${
                        isOpen
                          ? "bg-success/10 text-success border-success/30 hover:bg-success/20"
                          : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                      }`}
                    >
                      {isOpen
                        ? <><LockOpen className="w-3 h-3" /> অর্ডার খোলা — বন্ধ করুন</>
                        : <><Lock className="w-3 h-3" /> অর্ডার বন্ধ — খুলুন</>
                      }
                    </button>

                    <div className="flex gap-2 justify-center flex-wrap" onClick={e => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => { setShowQR(baseMenuUrl(table.id)); setQrType("table"); setQrLabel(table.name); setQrSublabel(""); }}>
                        <QrCode className="w-3 h-3" /> টেবিল QR
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSeatTable(table)}>
                        <Armchair className="w-3 h-3" /> সিট
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
              );
            })}
          </div>
        )}

        {seatTable && restaurantId && (
          <SeatManagement
            table={seatTable}
            restaurantId={restaurantId}
            open={!!seatTable}
            onClose={() => setSeatTable(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminTables;
