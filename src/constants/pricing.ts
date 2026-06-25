export const PRICING = {
  basic: {
    id: "basic",
    name: "বেসিক",
    yearlyPrice: 1990,
    priceText: "৳১৯৯০/বছর",
    priceBn: "১৯৯০",
    features: ["৫০টি মেনু আইটেম", "৫টি টেবিল", "৩ জন স্টাফ", "QR অর্ডারিং", "রিয়েলটাইম নোটিফিকেশন"],
  },
  premium: {
    id: "premium",
    name: "প্রিমিয়াম",
    yearlyPrice: 2990,
    priceText: "৳২৯৯০/বছর",
    priceBn: "২৯৯০",
    popular: true,
    features: ["২০০টি মেনু আইটেম", "২০টি টেবিল", "১৫ জন স্টাফ", "সব বেসিক ফিচার", "অ্যানালিটিক্স ড্যাশবোর্ড", "প্রায়োরিটি সাপোর্ট"],
  },
  enterprise: {
    id: "enterprise",
    name: "এন্টারপ্রাইজ",
    yearlyPrice: 4990,
    priceText: "৳৪৯৯০/বছর",
    priceBn: "৪৯৯০",
    features: ["আনলিমিটেড মেনু", "আনলিমিটেড টেবিল", "আনলিমিটেড স্টাফ", "সব প্রিমিয়াম ফিচার"],
  },
} as const;

export const PLANS_LIST = [PRICING.basic, PRICING.premium, PRICING.enterprise];
