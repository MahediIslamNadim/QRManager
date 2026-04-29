export const PRICING = {
  basic: {
    id: "basic",
    name: "বেসিক",
    monthlyPrice: 199,
    yearlyPrice: 1990,
    priceText: "৳১৯৯/মাস",
    priceBn: "১৯৯",
    features: ["৫০টি মেনু আইটেম", "৫টি টেবিল", "৩ জন স্টাফ", "QR অর্ডারিং", "রিয়েলটাইম নোটিফিকেশন"],
  },
  premium: {
    id: "premium",
    name: "প্রিমিয়াম",
    monthlyPrice: 299,
    yearlyPrice: 2990,
    priceText: "৳২৯৯/মাস",
    priceBn: "২৯৯",
    popular: true,
    features: ["২০০টি মেনু আইটেম", "২০টি টেবিল", "১৫ জন স্টাফ", "সব বেসিক ফিচার", "অ্যানালিটিক্স ড্যাশবোর্ড", "প্রায়োরিটি সাপোর্ট"],
  },
  enterprise: {
    id: "enterprise",
    name: "এন্টারপ্রাইজ",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    priceText: "৳৪৯৯/মাস",
    priceBn: "৪৯৯",
    features: ["আনলিমিটেড মেনু", "আনলিমিটেড টেবিল", "আনলিমিটেড স্টাফ", "সব প্রিমিয়াম ফিচার"],
  },
} as const;

export const PLANS_LIST = [PRICING.basic, PRICING.premium, PRICING.enterprise];
