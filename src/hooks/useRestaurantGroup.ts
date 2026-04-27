import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RestaurantGroup } from './useGroupOwner';

export interface BranchInfo {
  id: string;
  name: string;
  branch_code: string | null;
  status: string;
  address: string | null;
  subscription_status: string | null;
  group_id: string | null;
  is_branch: boolean;
}

export interface GroupWithBranches extends RestaurantGroup {
  branches: BranchInfo[];
}

export function useRestaurantGroup(groupId: string | null) {
  return useQuery<GroupWithBranches | null>({
    queryKey: ['restaurant-group', groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const [groupRes, branchRes] = await Promise.all([
        supabase.from('restaurant_groups').select('*').eq('id', groupId).single(),
        supabase
          .from('restaurants')
          .select('id, name, branch_code, status, address, subscription_status, group_id, is_branch')
          .eq('group_id', groupId)
          .order('name'),
      ]);
      if (groupRes.error) throw groupRes.error;
      return {
        ...(groupRes.data as RestaurantGroup),
        branches: (branchRes.data ?? []) as BranchInfo[],
      };
    },
    enabled: !!groupId,
  });
}

export interface BranchAnalytics {
  restaurant_id: string;
  name: string;
  branch_code: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
}

export interface GroupAnalytics {
  total_revenue: number;
  total_orders: number;
  per_branch: BranchAnalytics[];
}

export function useGroupAnalytics(groupId: string | null) {
  return useQuery<GroupAnalytics>({
    queryKey: ['group-analytics', groupId],
    queryFn: async () => {
      if (!groupId) return { total_revenue: 0, total_orders: 0, per_branch: [] };
      const { data, error } = await supabase.rpc('get_group_analytics', { p_group_id: groupId });
      if (error) throw error;
      const raw = data as GroupAnalytics;
      return {
        total_revenue: Number(raw?.total_revenue ?? 0),
        total_orders: Number(raw?.total_orders ?? 0),
        per_branch: (raw?.per_branch ?? []).map((b) => ({
          ...b,
          revenue: Number(b.revenue),
          orders: Number(b.orders),
          avg_order_value: Number(b.avg_order_value),
        })),
      };
    },
    enabled: !!groupId,
    refetchInterval: 30_000,
  });
}

export interface LiveOrder {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  table_id: string | null;
  status: string;
  total: number;
  created_at: string;
  notes: string | null;
}

export function useGroupOrders(groupId: string | null, branchIds: string[]) {
  const queryClient = useQueryClient();

  const query = useQuery<LiveOrder[]>({
    queryKey: ['group-orders', groupId],
    queryFn: async () => {
      if (!groupId || branchIds.length === 0) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, restaurant_id, table_id, status, total, created_at, notes, restaurants(name)')
        .in('restaurant_id', branchIds)
        .not('status', 'in', '(delivered,completed,cancelled)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        id: o.id,
        restaurant_id: o.restaurant_id,
        restaurant_name: o.restaurants?.name ?? '—',
        table_id: o.table_id,
        status: o.status,
        total: Number(o.total),
        created_at: o.created_at,
        notes: o.notes,
      }));
    },
    enabled: !!groupId && branchIds.length > 0,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!groupId || branchIds.length === 0) return;

    const channel = supabase
      .channel(`group-orders-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['group-orders', groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-analytics', groupId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, branchIds.length, queryClient]);

  return query;
}

export interface SharedMenuItem {
  id: string;
  group_id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useSharedMenu(groupId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery<SharedMenuItem[]>({
    queryKey: ['shared-menu', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from('group_shared_menus')
        .select('*')
        .eq('group_id', groupId)
        .order('category')
        .order('name');
      if (error) throw error;
      return (data ?? []) as SharedMenuItem[];
    },
    enabled: !!groupId,
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<SharedMenuItem, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('group_shared_menus').insert(item).select().single();
      if (error) throw error;
      return data as SharedMenuItem;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shared-menu', groupId] }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SharedMenuItem> & { id: string }) => {
      const { error } = await supabase.from('group_shared_menus').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shared-menu', groupId] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('group_shared_menus').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shared-menu', groupId] }),
  });

  return { ...query, createItem, updateItem, deleteItem };
}

export interface BranchOverride {
  id: string;
  restaurant_id: string;
  shared_menu_item_id: string;
  custom_price: number | null;
  is_available: boolean;
}

export function useBranchMenuOverrides(restaurantId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery<BranchOverride[]>({
    queryKey: ['branch-overrides', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('branch_menu_overrides')
        .select('*')
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      return (data ?? []) as BranchOverride[];
    },
    enabled: !!restaurantId,
  });

  const upsertOverride = useMutation({
    mutationFn: async (
      override: Omit<BranchOverride, 'id'>,
    ) => {
      const { error } = await supabase
        .from('branch_menu_overrides')
        .upsert(override, { onConflict: 'restaurant_id,shared_menu_item_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branch-overrides', restaurantId] }),
  });

  return { ...query, upsertOverride };
}
