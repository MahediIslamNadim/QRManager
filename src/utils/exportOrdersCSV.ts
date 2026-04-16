interface OrderRow {
  id: string;
  created_at: string;
  total: number;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  table_name: string;
  items: string;
}

function escapeCSV(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportOrdersCSV(orders: OrderRow[], filename: string) {
  const headers = ["অর্ডার ID", "তারিখ", "সময়", "টেবিল", "আইটেম", "মোট (৳)", "স্ট্যাটাস", "পেমেন্ট স্ট্যাটাস", "পেমেন্ট মাধ্যম"];

  const statusLabel = (s: string) =>
    s === "pending" ? "পেন্ডিং" : s === "preparing" ? "রান্না হচ্ছে" : s === "served" ? "সার্ভড" : s === "completed" ? "সম্পন্ন" : s;

  const rows = orders.map(o => {
    const dt = new Date(o.created_at);
    const date = dt.toLocaleDateString("en-BD");
    const time = dt.toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" });
    return [
      escapeCSV(o.id.slice(0, 8)),
      escapeCSV(date),
      escapeCSV(time),
      escapeCSV(o.table_name),
      escapeCSV(o.items),
      escapeCSV(o.total),
      escapeCSV(statusLabel(o.status)),
      escapeCSV(o.payment_status === "paid" ? "পেইড" : "বকেয়া"),
      escapeCSV(o.payment_method ?? "—"),
    ].join(",");
  });

  const bom = "\uFEFF"; // UTF-8 BOM so Excel shows Bengali correctly
  const csv = bom + [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
