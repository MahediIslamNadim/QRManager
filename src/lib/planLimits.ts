export type PlanId = "basic" | "premium" | "enterprise";

export interface PlanLimits {
  maxMenuItems: number;
  maxTables: number;
  maxStaff: number;
  label: string;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  basic: {
    maxMenuItems: 50,
    maxTables: 5,
    maxStaff: 3,
    label: "বেসিক",
  },
  premium: {
    maxMenuItems: 200,
    maxTables: 20,
    maxStaff: 15,
    label: "প্রিমিয়াম",
  },
  enterprise: {
    maxMenuItems: Infinity,
    maxTables: Infinity,
    maxStaff: Infinity,
    label: "এন্টারপ্রাইজ",
  },
};

export const getPlanLimits = (plan: string): PlanLimits => {
  return PLAN_LIMITS[plan as PlanId] || PLAN_LIMITS.basic;
};

export const formatLimit = (limit: number): string => {
  return limit === Infinity ? "আনলিমিটেড" : String(limit);
};
