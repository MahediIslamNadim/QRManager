# 🍽️ Tasty QR Spot

A modern **QR-based restaurant management SaaS platform** built with React, TypeScript, and Supabase. Customers can scan a QR code to browse the menu and place orders — no app download needed!

---

## 🚀 Features

### 👑 Super Admin
- Manage multiple restaurants on the platform
- View platform-wide analytics & revenue
- Manage users and subscription payments

### 🏪 Restaurant Admin
- Manage menu items, categories, and pricing
- Track and update live orders
- Manage tables, QR codes, and staff
- View restaurant analytics

### 🧑‍🍳 Waiter
- View assigned tables and active orders
- Receive real-time notifications
- Manage seat assignments

### 👤 Customer
- Scan QR code to access the menu
- Select seat and place orders instantly
- No login or app required

---

## 🛠️ Tech Stack

| Technology | Usage |
|---|---|
| React + TypeScript | Frontend |
| Vite | Build tool |
| Tailwind CSS | Styling |
| shadcn/ui | UI Components |
| Supabase | Database + Auth + Realtime |

---

## 📦 Getting Started
```bash
# Clone the repository
git clone https://github.com/MahediIslamNadim/tasty-qr-spot.git

# Navigate to project
cd tasty-qr-spot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your Supabase credentials

# Start development server
npm run dev
```

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 📁 Project Structure
```
src/
├── components/     # Reusable UI components
├── pages/          # Route-based pages
│   ├── Admin*      # Restaurant admin pages
│   ├── SuperAdmin* # Platform admin pages
│   ├── Waiter*     # Waiter dashboard pages
│   └── Customer*   # Customer-facing pages
├── hooks/          # Custom React hooks
├── integrations/   # Supabase client setup
└── lib/            # Utility functions
```

---

## 👨‍💻 Author

**Mahedi Islam Nadim**  
[GitHub](https://github.com/MahediIslamNadim)

---

## 📄 License

This project is for personal/educational use.
