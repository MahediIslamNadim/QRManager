export const PRICING = {
  basic: {
    id: "basic",
    name: "বেসিক",
    monthlyPrice: 399,
    yearlyPrice: 3990,
    priceText: "৳৩৯৯/মাস",
    priceBn: "৩৯৯",
    features: ["৫০টি মেনু আইটেম", "৫টি টেবিল", "৩ জন স্টাফ", "QR অর্ডারিং", "রিয়েলটাইম নোটিফিকেশন"],
  },
  premium: {
    id: "premium",
    name: "প্রিমিয়াম",
    monthlyPrice: 699,
    yearlyPrice: 6990,
    priceText: "৳৬৯৯/মাস",
    priceBn: "৬৯৯",
    popular: true,
    features: ["২০০টি মেনু আইটেম", "২০টি টেবিল", "১৫ জন স্টাফ", "সব বেসিক ফিচার", "অ্যানালিটিক্স ড্যাশবোর্ড", "প্রায়োরিটি সাপোর্ট"],
  },
  enterprise: {
    id: "enterprise",
    name: "এন্টারপ্রাইজ",
    monthlyPrice: 1199,
    yearlyPrice: 11990,
    priceText: "৳১,১৯৯/মাস",
    priceBn: "১,১৯৯",
    features: ["আনলিমিটেড মেনু", "আনলিমিটেড টেবিল", "আনলিমিটেড স্টাফ", "সব প্রিমিয়াম ফিচার", "মাল্টি-ব্রাঞ্চ", "ডেডিকেটেড সাপোর্ট"],
  },
} as const;

export const PLANS_LIST = [PRICING.basic, PRICING.premium, PRICING.enterprise];
