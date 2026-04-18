import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, QrCode, Armchair, Copy, Download, Printer, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCodeLib from "qrcode";

interface SeatManagementProps {
  table: any;
  restaurantId: string;
  open: boolean;
  onClose: () => void;
}

const SeatManagement = ({ table, restaurantId, open, onClose }: SeatManagementProps) => {
  const queryClient = useQueryClient();
  const [showSeatQR, setShowSeatQR] = useState<{ url: string; label: string; sublabel?: string } | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawQR = useCallback(async (canvas: HTMLCanvasElement, url: string, label: string, sublabel?: string) => {
    const qrSize = 240; const pad = 20;
    const bottomH = sublabel ? 72 : 52;
    canvas.width = qrSize + pad * 2;
    canvas.height = qrSize + pad * 2 + bottomH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tmp = document.createElement("canvas");
    await QRCodeLib.toCanvas(tmp, url, { width: qrSize, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
    ctx.drawImage(tmp, pad, pad);
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, qrSize + pad + 10); ctx.lineTo(canvas.width - pad, qrSize + pad + 10); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillStyle = "#111827";
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

  const qrCanvasCallback = useCallback((canvas: HTMLCanvasElement | null) => {
    qrCanvasRef.current = canvas;
    if (canvas && showSeatQR) drawQR(canvas, showSeatQR.url, showSeatQR.label, showSeatQR.sublabel);
  }, [showSeatQR, drawQR]);

  const handleQRDownload = () => {
    const canvas = qrCanvasRef.current; if (!canvas) return;
    const a = document.createElement("a");
    a.download = `qr-${showSeatQR?.label?.replace(/\s+/g, "-") || "seat"}.png`;
    a.href = canvas.toDataURL("image/png"); a.click();
    toast.success("QR কোড ডাউনলোড হয়েছে!");
  };

  const handleQRPrint = () => {
    const canvas = qrCanvasRef.current; if (!canvas) return;
    const img = canvas.toDataURL("image/png");
    const w = window.open("", "_blank")!;
    w.document.write(`<html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff"><div style="text-align:center"><img src="${img}" style="max-width:320px"/></div></body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const handleQRShare = async () => {
    const canvas = qrCanvasRef.current; if (!canvas) return;
    if (navigator.share) {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.share({ title: `QR — ${showSeatQR?.label}`, files: [new File([blob], `qr.png`, { type: "image/png" })] });
        } catch { navigator.clipboard.writeText(showSeatQR!.url); toast.success("লিংক কপি হয়েছে!"); }
      }, "image/png");
    } else { navigator.clipboard.writeText(showSeatQR!.url); toast.success("লিংক কপি হয়েছে!"); }
  };

  const { data: seats = [] } = useQuery({
    queryKey: ["table-seats", table?.id],
    queryFn: async () => {
      if (!table?.id) return [];
      const { data } = await supabase
        .from("table_seats")
        .select("*")
        .eq("table_id", table.id)
        .order("seat_number");
      return data || [];
    },
    enabled: !!table?.id,
  });

  const addSeatMutation = useMutation({
    mutationFn: async () => {
      const nextNumber = seats.length > 0 ? Math.max(...seats.map((s: any) => s.seat_number)) + 1 : 1;
      if (nextNumber > table.seats) {
        throw new Error(`সর্বোচ্চ ${table.seats} টি সিট যোগ করা যায়`);
      }
      const { error } = await supabase.from("table_seats").insert({
        table_id: table.id,
        restaurant_id: restaurantId,
        seat_number: nextNumber,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-seats", table.id] });
      toast.success("সিট যোগ হয়েছে");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addAllSeatsMutation = useMutation({
    mutationFn: async () => {
      const existingNumbers = new Set(seats.map((s: any) => s.seat_number));
      const newSeats = [];
      for (let i = 1; i <= table.seats; i++) {
        if (!existingNumbers.has(i)) {
          newSeats.push({ table_id: table.id, restaurant_id: restaurantId, seat_number: i });
        }
      }
      if (newSeats.length === 0) throw new Error("সব সিট আগেই যোগ করা হয়েছে");
      const { error } = await supabase.from("table_seats").insert(newSeats);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-seats", table.id] });
      toast.success("সব সিট যোগ হয়েছে");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteSeatMutation = useMutation({
    mutationFn: async (seatId: string) => {
      const { error } = await supabase.from("table_seats").delete().eq("id", seatId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-seats", table.id] });
      toast.success("সিট মুছে ফেলা হয়েছে");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleSeatStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("table_seats").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["table-seats", table.id] }),
  });

  const seatMenuUrl = (seatId: string) =>
    `${window.location.origin}/menu/${restaurantId}?table=${table.id}&seat=${seatId}`;

  const tableMenuUrl = () =>
    `${window.location.origin}/menu/${restaurantId}?table=${table.id}`;

  if (!table) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Armchair className="w-5 h-5 text-primary" />
              টেবিল {table.name} — সিট ম্যানেজমেন্ট
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Table QR */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">📋 টেবিল QR (গ্রুপ অর্ডার)</p>
                  <p className="text-xs text-muted-foreground">সিট সিলেক্ট করে অর্ডার করতে পারবে</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSeatQR({ url: tableMenuUrl(), label: `টেবিল ${table.name}` })}
                >
                  <QrCode className="w-3.5 h-3.5" /> QR
                </Button>
              </div>
            </div>

            {/* Seat Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => addSeatMutation.mutate()}
                disabled={seats.length >= table.seats}
              >
                <Plus className="w-3.5 h-3.5" /> সিট যোগ
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={() => addAllSeatsMutation.mutate()}
                disabled={seats.length >= table.seats}
              >
                <Plus className="w-3.5 h-3.5" /> সব সিট যোগ ({table.seats} টি)
              </Button>
            </div>

            {/* Seats Grid */}
            {seats.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                কোনো সিট নেই। "সব সিট যোগ" বাটনে ক্লিক করুন।
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto">
                {seats.map((seat: any) => {
                  const isOccupied = seat.status === "occupied";
                  return (
                    <div
                      key={seat.id}
                      className={`relative p-3 rounded-xl border transition-all ${
                        isOccupied
                          ? "bg-destructive/10 border-destructive/30"
                          : "bg-success/10 border-success/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Armchair className={`w-4 h-4 ${isOccupied ? "text-destructive" : "text-success"}`} />
                          <span className="font-semibold text-sm text-foreground">সিট {seat.seat_number}</span>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${isOccupied ? "bg-destructive" : "bg-success"}`} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {isOccupied ? "ব্যস্ত" : "ফাঁকা"}
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setShowSeatQR({ url: seatMenuUrl(seat.id), label: `টেবিল ${table.name}`, sublabel: `সিট ${seat.seat_number}` });
                          }}
                          className="flex-1 h-7 rounded-lg bg-card border border-border text-xs flex items-center justify-center gap-1 hover:bg-accent transition-colors"
                        >
                          <QrCode className="w-3 h-3" /> QR
                        </button>
                        <button
                          onClick={() => toggleSeatStatus.mutate({
                            id: seat.id,
                            status: isOccupied ? "available" : "occupied",
                          })}
                          className="flex-1 h-7 rounded-lg bg-card border border-border text-xs flex items-center justify-center hover:bg-accent transition-colors"
                        >
                          {isOccupied ? "ফাঁকা করুন" : "ব্যস্ত করুন"}
                        </button>
                        <button
                          onClick={() => deleteSeatMutation.mutate(seat.id)}
                          className="w-7 h-7 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
              <span>মোট: {seats.length}/{table.seats} সিট</span>
              <span>
                ফাঁকা: {seats.filter((s: any) => s.status === "available").length} | 
                ব্যস্ত: {seats.filter((s: any) => s.status === "occupied").length}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Seat/Table QR Dialog — canvas-based */}
      <Dialog open={!!showSeatQR} onOpenChange={() => setShowSeatQR(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              {showSeatQR?.label}{showSeatQR?.sublabel ? ` — ${showSeatQR.sublabel}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              showSeatQR?.sublabel
                ? "bg-info/10 border border-info/30 text-info"
                : "bg-success/10 border border-success/30 text-success"
            }`}>
              {showSeatQR?.sublabel ? "🪑 সিট QR — সরাসরি মেনুতে যাবে" : "👥 টেবিল QR — Seat Select করতে হবে"}
            </div>

            <div className="flex justify-center">
              <canvas
                ref={qrCanvasCallback}
                className="rounded-2xl border border-border shadow-md"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </div>

            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                🔗 লিংক দেখুন
              </summary>
              <code className="block mt-2 p-2.5 bg-secondary rounded-lg text-[11px] break-all text-foreground">{showSeatQR?.url}</code>
            </details>

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
              <Button variant="outline" className="h-11" onClick={() => { navigator.clipboard.writeText(showSeatQR!.url); toast.success("লিংক কপি হয়েছে!"); }}>
                <Copy className="w-4 h-4 mr-1.5" /> কপি লিংক
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SeatManagement;
