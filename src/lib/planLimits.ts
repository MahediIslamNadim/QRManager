export type PlanId = "medium_smart" | "high_smart" | "high_smart_enterprise";

export interface PlanLimits {
  maxMenuItems: number;
  maxTables: number;
  maxStaff: number;
  label: string;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  medium_smart: {
    maxMenuItems: 100,
    maxTables: 20,
    maxStaff: 5,
    label: "মিডিয়াম স্মার্ট",
  },
  high_smart: {
    maxMenuItems: Infinity,
    maxTables: Infinity,
    maxStaff: Infinity,
    label: "হাই স্মার্ট",
  },
  high_smart_enterprise: {
    maxMenuItems: Infinity,
    maxTables: Infinity,
    maxStaff: Infinity,
    label: "হাই স্মার্ট এন্টারপ্রাইজ",
  },
};

export const getPlanLimits = (plan: string): PlanLimits => {
  return PLAN_LIMITS[plan as PlanId] || PLAN_LIMITS.medium_smart;
};

export const formatLimit = (limit: number): string => {
  return limit === Infinity ? "আনলিমিটেড" : String(limit);
};
