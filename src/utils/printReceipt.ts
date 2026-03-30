const esc = (s: string) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

interface ReceiptOrder {
  id: string;
  total: number | string;
  created_at: string;
  payment_method?: string;
  payment_status?: string;
  paid_to_staff_name?: string;
  restaurant_tables?: { name: string } | null;
  table_seats?: { seat_number: number } | null;
  order_items?: { name: string; quantity: number; price: number }[];
}

export function printReceipt(order: ReceiptOrder, restaurantName: string) {
  const items = order.order_items || [];
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const now = new Date(order.created_at);
  const dateStr = now.toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
  const payMethod = order.payment_method === "bkash" ? "bKash" : "ক্যাশ";
  const isPaid = order.payment_status === "paid";

  const itemRows = items.map(i => `
    <tr>
      <td style="padding:3px 0;font-size:13px;">${esc(i.name)}</td>
      <td style="text-align:center;padding:3px 4px;font-size:13px;">${i.quantity}</td>
      <td style="text-align:right;padding:3px 0;font-size:13px;">৳${i.price}</td>
      <td style="text-align:right;padding:3px 0;font-size:13px;font-weight:600;">৳${i.price * i.quantity}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <title>রসিদ — #${order.id.slice(0, 6).toUpperCase()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      width: 80mm;
      margin: 0 auto;
      padding: 8px;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .divider { border: none; border-top: 1px dashed #888; margin: 8px 0; }
    .divider-solid { border: none; border-top: 2px solid #111; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; color: #555; text-transform: uppercase; padding: 2px 0; }
    .total-row td { font-size: 15px; font-weight: 700; padding-top: 6px; }
    .paid-badge {
      display: inline-block;
      background: #16a34a;
      color: #fff;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      margin-top: 4px;
    }
    .footer { font-size: 11px; color: #666; text-align: center; margin-top: 10px; }
    @media print {
      body { width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:10px;">
    <div class="bold" style="font-size:18px;">${esc(restaurantName)}</div>
    <div style="font-size:11px;color:#555;margin-top:2px;">QRManager — ডিজিটাল রেস্টুরেন্ট</div>
  </div>

  <hr class="divider-solid" />

  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
    <span>অর্ডার: <span class="bold">#${order.id.slice(0, 6).toUpperCase()}</span></span>
    <span>${dateStr}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:12px;">
    <span>টেবিল: <span class="bold">${order.restaurant_tables?.name || "N/A"}${order.table_seats?.seat_number ? ` — সিট ${order.table_seats.seat_number}` : ""}</span></span>
    <span>${timeStr}</span>
  </div>

  <hr class="divider" />

  <table>
    <thead>
      <tr>
        <th style="text-align:left;">আইটেম</th>
        <th style="text-align:center;">পরিমাণ</th>
        <th style="text-align:right;">দাম</th>
        <th style="text-align:right;">মোট</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <hr class="divider" />

  <table>
    <tr class="total-row">
      <td colspan="3">মোট পরিশোধযোগ্য</td>
      <td style="text-align:right;">৳${subtotal}</td>
    </tr>
  </table>

  ${isPaid ? `
  <hr class="divider" />
  <div style="font-size:12px;">
    <div style="display:flex;justify-content:space-between;">
      <span>পেমেন্ট পদ্ধতি:</span>
      <span class="bold">${payMethod}</span>
    </div>
    ${order.paid_to_staff_name ? `<div style="display:flex;justify-content:space-between;margin-top:3px;">
      <span>গ্রহণকারী:</span>
      <span class="bold">${esc(order.paid_to_staff_name!)}</span>
    </div>` : ""}
    <div class="center" style="margin-top:6px;">
      <span class="paid-badge">✓ পরিশোধিত</span>
    </div>
  </div>
  ` : `
  <hr class="divider" />
  <div class="center" style="font-size:12px;color:#888;">পেমেন্ট বাকি আছে</div>
  `}

  <hr class="divider" />

  <div class="footer">
    <div>আমাদের সেবা গ্রহণের জন্য ধন্যবাদ!</div>
    <div style="margin-top:2px;">পরিচালিত: QRManager</div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) { alert("Popup block করা আছে। Browser settings থেকে allow করুন।"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}
