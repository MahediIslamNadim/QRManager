# QRManager

QRManager is a QR-based restaurant ordering and operations platform built for Bangladesh-based restaurant workflows. Customers scan a table QR code, browse the menu, place orders without installing an app, and staff handle the rest through role-based dashboards.

The current codebase includes a public landing flow, restaurant admin tools, waiter tools, kitchen display, customer ordering screens, super-admin controls, subscription billing, payment callbacks, and a Supabase-backed serverless backend.

Powered by [NexCore Technologies](https://www.facebook.com/min.pikacoo)

## What the app includes

### Public pages
- Landing page
- Login and signup
- Pricing and feature pages
- Demo menu
- Reset password

### Super admin
- Platform dashboard
- Restaurant management
- User management
- Payments review and approval
- Platform analytics
- Super admin settings

### Restaurant admin
- Dashboard with restaurant stats
- AI Daily Summary for owner-facing daily sales insights
- Menu Intelligence suggestions for item naming, descriptions, categories, pricing, and combos
- AI Feedback Analysis for customer sentiment, complaints, and action items
- Menu management with image upload
- Table and QR management
- Orders and payment collection
- Staff management
- Analytics
- Customer feedback
- Billing and upgrades
- AI insights
- Reports
- Support
- Restaurant settings and branding

### Waiter and kitchen
- Waiter dashboard
- Seat request handling
- Notifications
- Kitchen display route shared across admin, waiter, and kitchen roles

### Customer flow
- Short-code redirect to restaurant menu
- Seat selection
- Menu browsing
- Order placement
- Review submission

## Current route map

The main routes are defined in [src/App.tsx](/c:/Users/hhnad/OneDrive/Desktop/NexCore/QRManager/src/App.tsx:1).

- `/` public landing page
- `/login`, `/reset-password`, `/pricing`, `/features`, `/demo`
- `/super-admin/*` super-admin interface
- `/admin/*` restaurant admin interface
- `/waiter/*` waiter interface
- `/admin/kitchen` kitchen display
- `/menu/:restaurantId` customer menu
- `/menu/:restaurantId/select-seat` seat selection
- `/r/:shortCode` short-code redirect
- `/payment/result` SSLCommerz result screen

## Roles and access model

Authentication and role resolution live in [src/hooks/useAuth.tsx](/c:/Users/hhnad/OneDrive/Desktop/NexCore/QRManager/src/hooks/useAuth.tsx:1) and protected routes are enforced in [src/components/ProtectedRoute.tsx](/c:/Users/hhnad/OneDrive/Desktop/NexCore/QRManager/src/components/ProtectedRoute.tsx:1).

Supported roles in the current app:

- `super_admin`
- `admin`
- `waiter`
- `kitchen`

## Pricing and subscription model

The primary tier system currently used by the app lives in [src/constants/tiers.ts](/c:/Users/hhnad/OneDrive/Desktop/NexCore/QRManager/src/constants/tiers.ts:1).

### Active tiers

| Tier | Monthly | Yearly | Limits | Highlights |
|------|---------|--------|--------|------------|
| Medium Smart | `৳999` | `৳9590` | 20 tables, 5 staff | QR ordering, analytics, notifications, payments |
| High Smart | `৳1999` | `৳19190` | Unlimited tables and staff | All Medium features, AI, predictive analytics, branding, reports, priority support |

### Trial

- Signup flow currently uses `FREE_TRIAL_DAYS = 14` from [src/constants/app.ts](/c:/Users/hhnad/OneDrive/Desktop/NexCore/QRManager/src/constants/app.ts:1)
- Trial activation and expiry handling also exist in Supabase functions

### Important note

There is also an older simplified plan list in [src/constants/pricing.ts](/c:/Users/hhnad/OneDrive/Desktop/NexCore/QRManager/src/constants/pricing.ts:1) that is still referenced by a few payment and trial-related screens. If you are changing pricing logic, check both files.

## Tech stack

### Frontend
- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- shadcn/ui and Radix UI
- Recharts
- Lucide React

### Backend and data
- Supabase Auth
- Supabase Postgres
- Supabase Realtime
- Supabase Storage
- Supabase Edge Functions

### AI and payments
- Google Gemini through Supabase Edge Functions
- Server-side AI summary and analytics helpers
- SSLCommerz payment flow
- Manual payment request handling for bKash and Nagad

### Extra backend
- Minimal FastAPI stub in [backend/main.py](/c:/Users/hhnad/OneDrive/Desktop/NexCore/QRManager/backend/main.py:1)

## Environment variables

Frontend env usage is spread across `src/integrations`, payment pages, and AI features. The current app expects these values:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_BKASH_NUMBER=your_bkash_number
VITE_NAGAD_NUMBER=your_nagad_number
```

Notes:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are required
- `VITE_BKASH_NUMBER` and `VITE_NAGAD_NUMBER` are needed for payment flows
- AI provider keys must be configured as Supabase Edge Function secrets, not `VITE_*` frontend variables
- `GEMINI_API_KEY` powers the server-side `ai-analytics`, `ai-daily-summary`, `menu-intelligence`, and `feedback-analysis` functions

## Local development

### Prerequisites
- Node.js 18+
- npm
- A Supabase project

### Install and run

```bash
npm install
npm run dev
```

The Vite dev server is configured in [vite.config.ts](/c:/Users/hhnad/OneDrive/Desktop/NexCore/QRManager/vite.config.ts:1) and runs on:

```txt
http://localhost:8080
```

### Useful scripts

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
npm run typecheck
npm run lint
npm run test
npm run test:watch
```

## Supabase functions in this repo

Current functions inside [supabase/functions](/c:/Users/hhnad/OneDrive/Desktop/NexCore/QRManager/supabase/functions:1):

### Core staff and account workflows
- `activate-trial`
- `create-staff`
- `manage-user`
- `expire-trials`

### Payments and subscription activation
- `ssl-init`
- `ssl-ipn`
- `ssl-result`
- `process-payment`

### Notifications and reporting
- `notify-email`
- `notify-whatsapp`
- `daily-report`
- `ai-daily-summary`
- `menu-intelligence`
- `feedback-analysis`

### Enterprise and multi-branch support helpers
- `bootstrap-enterprise-restaurant`
- `create-enterprise-account`
- `create-enterprise-group-owner`
- `create-enterprise-restaurant-admin`
- `invite-branch-admin`
- `send-enterprise-notice`
- `enterprise-ai-analytics`

## Key data areas used by the app

From the frontend and edge-function code, these tables/features are part of the working system:

- `restaurants`
- `profiles`
- `user_roles`
- `staff_restaurants`
- `menu_items`
- `restaurant_tables`
- `table_seats`
- `orders`
- `order_items`
- `notifications`
- `reviews`
- `subscriptions`
- `payment_requests`
- `ssl_transactions`
- `support_tickets`
- `service_requests`

## Project structure

```txt
backend/
  main.py

public/
  favicon.ico
  placeholder.svg
  robots.txt

src/
  components/            reusable UI, layout, feature gates, seat management
  constants/             app config, tiers, pricing
  hooks/                 auth, limits, feature access, trial status
  integrations/          Supabase client and generated types
  lib/                   AI helpers, invoice/email helpers, utilities
  pages/                 public, customer, admin, waiter, super-admin screens
  test/                  Vitest setup and sample test
  utils/                 print and export helpers

supabase/
  config.toml
  functions/             edge functions
  migrations/            SQL migrations
```

## Developer notes

- The UI text is primarily Bangla, while most code identifiers are English
- The `@` alias points to `src`
- Vite HMR overlay is disabled in development
- Build output is manually chunked for React, Supabase, Query, charts, and UI bundles
- The FastAPI backend is currently only a placeholder and is not the main production backend for the app

## Verification status

This README was updated against the current source tree, route map, package manifest, Vite config, tier constants, auth flow, payment pages, and the Supabase function directory.

## License

Copyright 2026 NexCore Technologies. All rights reserved.
