# QRManager — ডিজিটাল রেস্টুরেন্ট ম্যানেজমেন্ট SaaS

> Bangladesh-এর রেস্টুরেন্টের জন্য তৈরি QR-based অর্ডারিং ও ম্যানেজমেন্ট প্ল্যাটফর্ম।
> Customer QR স্ক্যান করে অর্ডার দেয় — কোনো app download দরকার নেই।

**Powered by [NexCore Technologies](https://facebook.com/nexcoreltd)**

---

## Features

### Super Admin
- Multi-restaurant platform management
- Platform-wide analytics & revenue tracking
- User & subscription payment management

### Restaurant Admin
- Menu management (items, categories, images, availability)
- Live order tracking with real-time updates
- Table & QR code management
- Staff management with role-based access
- **Kitchen Display System (KDS)** — tablet-friendly dark screen for kitchen
- **Bill Print / Receipt** — 80mm thermal printer format
- **Today vs Yesterday stats** — AdminDashboard comparison
- **Customer Ratings** — avg star rating from last 30 days
- **Analytics** — weekly charts, top items, daily report PDF print
- **WhatsApp Notifications** — new order alerts via CallMeBot (free)
- **Daily Sales Report** — auto WhatsApp summary every night at 9 PM

### Waiter
- Active orders view with status updates
- Seat assignment & request management
- Payment collection (Cash / bKash)
- Kitchen Display access

### Customer
- Scan QR → browse menu → place order (no login needed)
- Real-time order status tracking
- **Star rating** after order is served

---

## Pricing

| Plan | Price | Features |
|------|-------|----------|
| Basic | ৳১৯৯/মাস | 30 menu items, 5 tables, 2 staff |
| Premium | ৳২৯৯/মাস | Unlimited menu, 20 tables, 10 staff |
| Enterprise | ৳৪৯৯/মাস | Everything unlimited |

**১৪ দিন ফ্রি ট্রায়াল** — no credit card required.

---

## Tech Stack

| Technology | Usage |
|------------|-------|
| React 18 + TypeScript | Frontend |
| Vite | Build tool |
| Tailwind CSS + shadcn/ui | Styling & UI components |
| Supabase | PostgreSQL + Auth + Realtime + Storage |
| Supabase Edge Functions | WhatsApp notifications, daily report |
| TanStack Query | Server state management |
| Recharts | Analytics charts |
| react-router-dom v6 | Routing |

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/MahediIslamNadim/QRManager.git
cd QRManager

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your Supabase credentials

# Start development server
npm run dev
```

---

## Environment Variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_BKASH_NUMBER=your_bkash_number
VITE_NAGAD_NUMBER=your_nagad_number
```

---

## Database Migrations

Run in Supabase SQL Editor after setup:

```sql
-- Customer ratings on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_comment TEXT;

-- WhatsApp notification settings
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS whatsapp_api_key TEXT,
  ADD COLUMN IF NOT EXISTS notify_new_order BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_daily_report BOOLEAN DEFAULT FALSE;
```

---

## Edge Functions (WhatsApp Notifications)

Deploy after setting up Supabase:

```bash
supabase functions deploy notify-whatsapp   # New order alert
supabase functions deploy daily-report      # Daily sales summary
```

Set up Database Webhook in Supabase Dashboard:
- **Table:** `orders` | **Event:** `INSERT` | **URL:** `.../functions/v1/notify-whatsapp`

For daily report cron, configure in Supabase Dashboard → Edge Functions → Schedules:
- **Schedule:** `0 15 * * *` (9 PM Bangladesh = 3 PM UTC)

---

## Project Structure

```
src/
├── pages/
│   ├── Admin*          # Restaurant admin dashboard
│   ├── SuperAdmin*     # Platform admin
│   ├── Waiter*         # Waiter interface
│   ├── Customer*       # Customer QR menu
│   ├── KitchenDisplay  # Kitchen tablet view
│   └── Index.tsx       # Landing page
├── components/         # Reusable UI components
├── hooks/useAuth.tsx   # Auth + restaurant context
├── constants/          # Pricing, plan limits, app config
├── utils/              # printReceipt, printDailyReport
├── integrations/       # Supabase client + types
└── lib/                # planLimits, utils
supabase/
├── functions/          # Edge functions (notify-whatsapp, daily-report)
└── migrations/         # SQL migration files
```

---

## Contact & Support

- **WhatsApp:** [+880 1786-130439](https://wa.me/8801786130439)
- **Facebook:** [NexCore Technologies](https://facebook.com/nexcoreltd)
- **Location:** Sylhet, Bangladesh

---

## License

© 2026 NexCore Technologies. All rights reserved.
