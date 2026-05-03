// generateInvoice.ts - PDF invoice generation
import { TIERS, formatPrice } from '@/constants/tiers';
import { format } from 'date-fns';

// Invoice data structure
export interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  dueDate?: Date;
  
  // Business info
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  
  // Subscription details
  tier: string;
  billingCycle: string;
  amount: number;
  
  // Payment details
  paymentMethod?: string;
  transactionId?: string;
  status: 'paid' | 'pending' | 'failed';
}

// Generate invoice HTML (can be converted to PDF)
export const generateInvoiceHTML = (data: InvoiceData): string => {
  const tierConfig = TIERS[data.tier as keyof typeof TIERS];
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #1f2937;
      line-height: 1.6;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #c9a84c;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #f5d780, #c9a84c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h1 {
      font-size: 36px;
      font-weight: 300;
      color: #6b7280;
    }
    .invoice-title p {
      font-size: 14px;
      color: #9ca3af;
      margin-top: 4px;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .info-box {
      flex: 1;
    }
    .info-box h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .info-box p {
      font-size: 14px;
      margin-bottom: 4px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
    }
    .items-table thead {
      background: #f9fafb;
    }
    .items-table th {
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .items-table td {
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .items-table tbody tr:last-child td {
      border-bottom: 2px solid #c9a84c;
    }
    .total-section {
      margin-left: auto;
      width: 300px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      font-size: 14px;
    }
    .total-row.final {
      border-top: 2px solid #c9a84c;
      font-size: 18px;
      font-weight: bold;
      padding-top: 16px;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-paid {
      background: #d1fae5;
      color: #065f46;
    }
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    .status-failed {
      background: #fee2e2;
      color: #991b1b;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    .payment-info {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 40px;
    }
    .payment-info h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .payment-info p {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">QR Manager</div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <p>${data.invoiceNumber}</p>
    </div>
  </div>

  <div class="info-section">
    <div class="info-box">
      <h3>From</h3>
      <p><strong>QR Manager</strong></p>
      <p>NexCore Ltd.</p>
      <p>Sylhet, Bangladesh</p>
      <p>support@qrmanager.com</p>
    </div>
    
    <div class="info-box">
      <h3>Bill To</h3>
      <p><strong>${data.businessName}</strong></p>
      ${data.businessAddress ? `<p>${data.businessAddress}</p>` : ''}
      ${data.businessPhone ? `<p>${data.businessPhone}</p>` : ''}
      ${data.businessEmail ? `<p>${data.businessEmail}</p>` : ''}
    </div>
    
    <div class="info-box">
      <h3>Invoice Details</h3>
      <p><strong>Date:</strong> ${format(data.date, 'MMM dd, yyyy')}</p>
      ${data.dueDate ? `<p><strong>Due:</strong> ${format(data.dueDate, 'MMM dd, yyyy')}</p>` : ''}
      <p><strong>Status:</strong> 
        <span class="status-badge status-${data.status}">
          ${data.status.toUpperCase()}
        </span>
      </p>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Period</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${tierConfig?.name || 'QR Manager Subscription'}</strong><br>
          <span style="font-size: 13px; color: #6b7280;">
            ${data.billingCycle === 'monthly' ? 'Monthly Subscription' : 'Annual Subscription'}
          </span>
        </td>
        <td>
          ${format(data.date, 'MMM dd, yyyy')} - ${format(
            data.billingCycle === 'monthly' 
              ? new Date(data.date.getTime() + 30 * 24 * 60 * 60 * 1000)
              : new Date(data.date.getTime() + 365 * 24 * 60 * 60 * 1000),
            'MMM dd, yyyy'
          )}
        </td>
        <td style="text-align: right; font-weight: 600;">
          ${formatPrice(data.amount)}
        </td>
      </tr>
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>${formatPrice(data.amount)}</span>
    </div>
    <div class="total-row">
      <span>Tax (0%):</span>
      <span>৳0</span>
    </div>
    <div class="total-row final">
      <span>Total:</span>
      <span>${formatPrice(data.amount)}</span>
    </div>
  </div>

  ${data.paymentMethod || data.transactionId ? `
    <div class="payment-info">
      <h3>Payment Information</h3>
      ${data.paymentMethod ? `<p><strong>Method:</strong> ${data.paymentMethod}</p>` : ''}
      ${data.transactionId ? `<p><strong>Transaction ID:</strong> ${data.transactionId}</p>` : ''}
      <p><strong>Status:</strong> ${data.status === 'paid' ? 'Payment Received' : data.status === 'pending' ? 'Awaiting Payment' : 'Payment Failed'}</p>
    </div>
  ` : ''}

  <div class="footer">
    <p><strong>Thank you for your business!</strong></p>
    <p style="margin-top: 8px;">Questions? Contact us at support@qrmanager.com</p>
    <p style="margin-top: 16px;">© ${new Date().getFullYear()} QR Manager by NexCore Ltd. All rights reserved.</p>
  </div>
</body>
</html>
`;
};

// Convert HTML to PDF using browser print or jsPDF
export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
  const html = generateInvoiceHTML(data);
  
  // Option 1: Use browser print to PDF (client-side)
  // This requires user interaction
  
  // Option 2: Use jsPDF with html2canvas (recommended)
  // Install: npm install jspdf html2canvas
  
  // For now, return HTML as blob
  // In production, use jsPDF or a server-side PDF service
  
  const blob = new Blob([html], { type: 'text/html' });
  return blob;
  
  /*
  // Production code with jsPDF:
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.width = '800px';
  document.body.appendChild(container);
  
  const canvas = await html2canvas(container);
  document.body.removeChild(container);
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
  */
};

// Download invoice
export const downloadInvoice = async (data: InvoiceData) => {
  const html = generateInvoiceHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${data.invoiceNumber}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
