interface DailyReportData {
  restaurantName: string;
  date: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrder: number;
  topItems: { name: string; value: number }[];
  statusMap: Record<string, number>;
  dailyData?: { day: string; orders: number; revenue: number }[];
}

export function printDailyReport(data: DailyReportData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });

  const statusLabels: Record<string, string> = {
    pending: "পেন্ডিং",
    preparing: "রান্না হয়েছে",
    served: "সার্ভড",
    completed: "সম্পন্ন",
    cancelled: "বাতিল",
  };

  const topItemRows = data.topItems.slice(0, 8).map((item, i) =>
    `<tr>
      <td style="padding:4px 0;font-size:13px;">${i + 1}. ${item.name}</td>
      <td style="text-align:right;padding:4px 0;font-size:13px;font-weight:600;">${item.value}টি</td>
    </tr>`
  ).join("");

  const statusRows = Object.entries(data.statusMap).map(([status, count]) =>
    `<tr>
      <td style="padding:3px 0;font-size:13px;">${statusLabels[status] || status}</td>
      <td style="text-align:right;padding:3px 0;font-size:13px;font-weight:600;">${count}</td>
    </tr>`
  ).join("");

  const weeklyRows = (data.dailyData || []).map(d =>
    `<tr>
      <td style="padding:3px 0;font-size:12px;">${d.day}</td>
      <td style="text-align:center;padding:3px 0;font-size:12px;">${d.orders}</td>
      <td style="text-align:right;padding:3px 0;font-size:12px;font-weight:600;">৳${d.revenue}</td>
    </tr>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <title>দৈনিক রিপোর্ট — ${data.restaurantName}</title>
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
    th { font-size: 11px; color: #555; text-transform: uppercase; padding: 2px 0; text-align: left; }
    .section-title { font-size: 12px; font-weight: 700; color: #333; margin: 6px 0 3px; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
    .summary-value { font-weight: 700; }
    .highlight { font-size: 16px; font-weight: 800; }
    .footer { font-size: 11px; color: #666; text-align: center; margin-top: 10px; }
    @media print {
      body { width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:10px;">
    <div class="bold" style="font-size:18px;">${data.restaurantName}</div>
    <div style="font-size:11px;color:#555;margin-top:2px;">দৈনিক বিক্রয় রিপোর্ট</div>
  </div>

  <hr class="divider-solid" />

  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
    <span>${dateStr}</span>
    <span>${timeStr}-এ তৈরি</span>
  </div>

  <hr class="divider" />

  <!-- Summary -->
  <div class="section-title">সারসংক্ষেপ</div>
  <div class="summary-row"><span>মোট অর্ডার</span><span class="summary-value highlight">${data.totalOrders}টি</span></div>
  <div class="summary-row"><span>মোট আয়</span><span class="summary-value highlight">৳${data.totalRevenue}</span></div>
  <div class="summary-row"><span>গড় অর্ডার মূল্য</span><span class="summary-value">৳${data.avgOrder}</span></div>

  <hr class="divider" />

  <!-- Top Items -->
  <div class="section-title">সর্বাধিক বিক্রীত আইটেম</div>
  <table>
    <tbody>${topItemRows || '<tr><td colspan="2" style="padding:4px 0;font-size:12px;color:#888;">কোনো ডেটা নেই</td></tr>'}</tbody>
  </table>

  <hr class="divider" />

  <!-- Status breakdown -->
  <div class="section-title">অর্ডার স্ট্যাটাস</div>
  <table>
    <tbody>${statusRows || '<tr><td colspan="2" style="padding:4px 0;font-size:12px;color:#888;">কোনো ডেটা নেই</td></tr>'}</tbody>
  </table>

  ${weeklyRows ? `
  <hr class="divider" />
  <div class="section-title">সাপ্তাহিক সারসংক্ষেপ</div>
  <table>
    <thead><tr><th>দিন</th><th style="text-align:center;">অর্ডার</th><th style="text-align:right;">আয়</th></tr></thead>
    <tbody>${weeklyRows}</tbody>
  </table>
  ` : ""}

  <hr class="divider" />

  <div class="footer">
    <div>পরিচালিত: QRManager</div>
    <div style="margin-top:2px;">ধন্যবাদ — ভালো ব্যবসা হোক! 🍽️</div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=420,height=700");
  if (!win) { alert("Popup block করা আছে। Browser settings থেকে allow করুন।"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}
