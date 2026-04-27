import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserGroups } from "@/hooks/useGroupOwner";

export interface EnterpriseRestaurantRow {
  restaurant_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: string;
  branch_code: string | null;
  subscription_status: string | null;
  created_at: string;
  today_orders: number;
  today_revenue: number;
  total_orders: number;
  total_revenue: number;
  menu_items_count: number;
  staff_count: number;
}

export interface EnterpriseDashboardSummary {
  total_restaurants: number;
  active_restaurants: number;
  today_orders: number;
  today_revenue: number;
  total_menu_items: number;
  pending_notices: number;
  top_snapshot: EnterpriseTopSellingRow[];
}

export interface EnterpriseTopSellingRow {
  restaurant_id: string;
  restaurant_name: string;
  item_name: string;
  quantity: number;
  revenue: number;
}

export interface EnterpriseAnalyticsData {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  restaurant_breakdown: Array<{
    restaurant_id: string;
    name: string;
    orders: number;
    revenue: number;
  }>;
  daily_trend: Array<{
    day: string;
    orders: number;
    revenue: number;
  }>;
  category_breakdown: Array<{
    category: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface EnterpriseNoticeHistoryItem {
  id: string;
  group_id: string;
  title: string;
  message: string;
  audience: "all" | "selected";
  send_email: boolean;
  created_at: string;
  created_by: string | null;
  target_count: number;
  delivered_count: number;
  emailed_count: number;
  target_restaurant_ids: string[];
}

export interface EnterpriseAiSummary {
  summary: string;
  focus_area: string;
  opportunities: string[];
  risks: string[];
  recommendations: string[];
}

export interface EnterpriseAddRestaurantPayload {
  group_id: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  admin_full_name: string;
  admin_email: string;
  admin_phone: string;
  admin_password: string;
}

const EMPTY_SUMMARY: EnterpriseDashboardSummary = {
  total_restaurants: 0,
  active_restaurants: 0,
  today_orders: 0,
  today_revenue: 0,
  total_menu_items: 0,
  pending_notices: 0,
  top_snapshot: [],
};

const EMPTY_ANALYTICS: EnterpriseAnalyticsData = {
  total_revenue: 0,
  total_orders: 0,
  avg_order_value: 0,
  restaurant_breakdown: [],
  daily_trend: [],
  category_breakdown: [],
};

const EMPTY_AI_SUMMARY: EnterpriseAiSummary = {
  summary: "AI summary is not available yet.",
  focus_area: "Collect more group activity to generate a stronger enterprise summary.",
  opportunities: [],
  risks: [],
  recommendations: [],
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value || 0);
  return 0;
};

export function useEnterpriseContext() {
  const { user, role, restaurantId, restaurantPlan } = useAuth();
  const groupsQuery = useUserGroups();

  const headOfficeQuery = useQuery({
    queryKey: ["enterprise-head-office", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, address, phone, group_id, logo_url, notify_email, notification_email")
        .eq("id", restaurantId)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: !!restaurantId && (role === "group_owner" || role === "super_admin"),
  });

  const resolvedGroupId = useMemo(() => {
    return groupsQuery.data?.[0]?.id ?? headOfficeQuery.data?.group_id ?? null;
  }, [groupsQuery.data, headOfficeQuery.data]);

  const groupQuery = useQuery({
    queryKey: ["enterprise-group", resolvedGroupId],
    queryFn: async () => {
      if (!resolvedGroupId) return null;
      const { data, error } = await supabase
        .from("restaurant_groups")
        .select("*")
        .eq("id", resolvedGroupId)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: !!resolvedGroupId,
  });

  return {
    user,
    role,
    restaurantId,
    restaurantPlan,
    groupId: resolvedGroupId,
    groups: groupsQuery.data ?? [],
    headOffice: headOfficeQuery.data ?? null,
    group: groupQuery.data ?? null,
    loading: groupsQuery.isLoading || headOfficeQuery.isLoading || groupQuery.isLoading,
    hasEnterpriseAccess:
      role === "group_owner" ||
      role === "super_admin" ||
      restaurantPlan === "high_smart_enterprise",
  };
}

export function useBootstrapEnterprise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      restaurantId,
      groupName,
    }: {
      restaurantId: string;
      groupName?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("bootstrap-enterprise-restaurant", {
        body: {
          restaurant_id: restaurantId,
          group_name: groupName,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-groups"] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-head-office"] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-group"] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-dashboard"] });
    },
  });
}

export function useEnterpriseDashboardSummary(groupId: string | null) {
  return useQuery<EnterpriseDashboardSummary>({
    queryKey: ["enterprise-dashboard", groupId],
    queryFn: async () => {
      if (!groupId) return EMPTY_SUMMARY;

      const { data, error } = await supabase.rpc(
        "get_enterprise_dashboard_summary" as any,
        { p_group_id: groupId } as any,
      );

      if (error) throw error;

      const raw = (data ?? {}) as Record<string, any>;
      const topSnapshot = Array.isArray(raw.top_snapshot)
        ? raw.top_snapshot.map((item: any) => ({
            restaurant_id: item.restaurant_id,
            restaurant_name: item.restaurant_name,
            item_name: item.item_name,
            quantity: toNumber(item.quantity),
            revenue: toNumber(item.revenue),
          }))
        : [];

      return {
        total_restaurants: toNumber(raw.total_restaurants),
        active_restaurants: toNumber(raw.active_restaurants),
        today_orders: toNumber(raw.today_orders),
        today_revenue: toNumber(raw.today_revenue),
        total_menu_items: toNumber(raw.total_menu_items),
        pending_notices: toNumber(raw.pending_notices),
        top_snapshot: topSnapshot,
      };
    },
    enabled: !!groupId,
    refetchInterval: 30_000,
  });
}

export function useEnterpriseRestaurants(groupId: string | null) {
  return useQuery<EnterpriseRestaurantRow[]>({
    queryKey: ["enterprise-restaurants", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase.rpc(
        "get_enterprise_restaurant_list" as any,
        { p_group_id: groupId } as any,
      );

      if (error) throw error;

      return ((data ?? []) as any[]).map((row) => ({
        restaurant_id: row.restaurant_id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        status: row.status,
        branch_code: row.branch_code,
        subscription_status: row.subscription_status,
        created_at: row.created_at,
        today_orders: toNumber(row.today_orders),
        today_revenue: toNumber(row.today_revenue),
        total_orders: toNumber(row.total_orders),
        total_revenue: toNumber(row.total_revenue),
        menu_items_count: toNumber(row.menu_items_count),
        staff_count: toNumber(row.staff_count),
      }));
    },
    enabled: !!groupId,
    refetchInterval: 30_000,
  });
}

export function useEnterpriseTopSelling(groupId: string | null) {
  return useQuery<EnterpriseTopSellingRow[]>({
    queryKey: ["enterprise-top-selling", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase.rpc(
        "get_enterprise_top_selling" as any,
        { p_group_id: groupId } as any,
      );

      if (error) throw error;

      return ((data ?? []) as any[]).map((row) => ({
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        item_name: row.item_name,
        quantity: toNumber(row.quantity),
        revenue: toNumber(row.revenue),
      }));
    },
    enabled: !!groupId,
    refetchInterval: 30_000,
  });
}

export function useEnterpriseAnalytics(groupId: string | null, restaurantId: string | null) {
  return useQuery<EnterpriseAnalyticsData>({
    queryKey: ["enterprise-analytics", groupId, restaurantId],
    queryFn: async () => {
      if (!groupId) return EMPTY_ANALYTICS;

      const { data, error } = await supabase.rpc(
        "get_enterprise_analytics" as any,
        {
          p_group_id: groupId,
          p_restaurant_id: restaurantId,
        } as any,
      );

      if (error) throw error;

      const raw = (data ?? {}) as Record<string, any>;
      return {
        total_revenue: toNumber(raw.total_revenue),
        total_orders: toNumber(raw.total_orders),
        avg_order_value: toNumber(raw.avg_order_value),
        restaurant_breakdown: Array.isArray(raw.restaurant_breakdown)
          ? raw.restaurant_breakdown.map((row: any) => ({
              restaurant_id: row.restaurant_id,
              name: row.name,
              orders: toNumber(row.orders),
              revenue: toNumber(row.revenue),
            }))
          : [],
        daily_trend: Array.isArray(raw.daily_trend)
          ? raw.daily_trend.map((row: any) => ({
              day: row.day,
              orders: toNumber(row.orders),
              revenue: toNumber(row.revenue),
            }))
          : [],
        category_breakdown: Array.isArray(raw.category_breakdown)
          ? raw.category_breakdown.map((row: any) => ({
              category: row.category,
              quantity: toNumber(row.quantity),
              revenue: toNumber(row.revenue),
            }))
          : [],
      };
    },
    enabled: !!groupId,
    refetchInterval: 30_000,
  });
}

export function useEnterpriseAiAnalytics(groupId: string | null, restaurantId: string | null) {
  return useQuery<EnterpriseAiSummary>({
    queryKey: ["enterprise-ai-analytics", groupId, restaurantId],
    queryFn: async () => {
      if (!groupId) return EMPTY_AI_SUMMARY;

      const { data, error } = await supabase.functions.invoke("enterprise-ai-analytics", {
        body: {
          group_id: groupId,
          restaurant_id: restaurantId,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return {
        summary: data?.summary || EMPTY_AI_SUMMARY.summary,
        focus_area: data?.focus_area || EMPTY_AI_SUMMARY.focus_area,
        opportunities: Array.isArray(data?.opportunities) ? data.opportunities : [],
        risks: Array.isArray(data?.risks) ? data.risks : [],
        recommendations: Array.isArray(data?.recommendations) ? data.recommendations : [],
      };
    },
    enabled: !!groupId,
    staleTime: 900_000,
  });
}

export function useEnterpriseNotices(groupId: string | null) {
  return useQuery<EnterpriseNoticeHistoryItem[]>({
    queryKey: ["enterprise-notices", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from("enterprise_notices" as any)
        .select(`
          id,
          group_id,
          title,
          message,
          audience,
          send_email,
          created_at,
          created_by,
          enterprise_notice_targets(
            restaurant_id,
            delivery_status,
            delivered_email_at
          )
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return ((data ?? []) as any[]).map((notice) => {
        const targets = Array.isArray(notice.enterprise_notice_targets)
          ? notice.enterprise_notice_targets
          : [];

        return {
          id: notice.id,
          group_id: notice.group_id,
          title: notice.title,
          message: notice.message,
          audience: notice.audience,
          send_email: !!notice.send_email,
          created_at: notice.created_at,
          created_by: notice.created_by,
          target_count: targets.length,
          delivered_count: targets.filter((target: any) =>
            ["in_app", "delivered", "partial"].includes(target.delivery_status),
          ).length,
          emailed_count: targets.filter((target: any) => !!target.delivered_email_at).length,
          target_restaurant_ids: targets.map((target: any) => target.restaurant_id),
        };
      });
    },
    enabled: !!groupId,
    refetchInterval: 15_000,
  });
}

export function useCreateEnterpriseRestaurant(groupId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: EnterpriseAddRestaurantPayload) => {
      const { data, error } = await supabase.functions.invoke("create-enterprise-restaurant-admin", {
        body: payload,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-restaurants", groupId] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-dashboard", groupId] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-top-selling", groupId] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-analytics", groupId] });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
    },
  });
}

export function useSendEnterpriseNotice(groupId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      message,
      audience,
      restaurantIds,
      sendEmail,
    }: {
      title: string;
      message: string;
      audience: "all" | "selected";
      restaurantIds: string[];
      sendEmail: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-enterprise-notice", {
        body: {
          group_id: groupId,
          title,
          message,
          audience,
          restaurant_ids: restaurantIds,
          send_email: sendEmail,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-notices", groupId] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-dashboard", groupId] });
    },
  });
}
