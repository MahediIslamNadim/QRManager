import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RestaurantGroup } from './useGroupOwner';

// ─── Sanitization helpers ────────────────────────────────────────────────────

/** Trim + normalize whitespace, max length clip */
const sanitizeText = (val: string | null | undefined, maxLen = 255): string | null => {
  if (!val) return null;
  const trimmed = val.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : null;
};

const ALLOWED_BRANCH_STATUSES = ['active', 'inactive'] as const;
type BranchStatus = (typeof ALLOWED_BRANCH_STATUSES)[number];

const assertBranchStatus = (s: string): BranchStatus => {
  if (!ALLOWED_BRANCH_STATUSES.includes(s as BranchStatus)) {
    throw new Error(`Invalid branch status: ${s}`);
  }
  return s as BranchStatus;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BranchInfo {
  id: string;
  name: string;
  branch_code: string | null;
  status: string;
  address: string | null;
  phone: string | null;
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
          .select('id, name, branch_code, status, address, phone, subscription_status, group_id, is_branch')
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

export interface BranchPayload {
  name: string;
  address: string | null;
  branch_code: string | null;
  phone: string | null;
  status: string;
}

/** Sanitize & validate branch payload before DB write */
const sanitizeBranchPayload = (branch: BranchPayload): BranchPayload => {
  const name = branch.name.trim().replace(/\s+/g, ' ').slice(0, 200);
  if (!name || name.length < 2) throw new Error('Branch name must be at least 2 characters');
  return {
    name,
    address: sanitizeText(branch.address, 500),
    branch_code: sanitizeText(branch.branch_code, 20),
    phone: sanitizeText(branch.phone, 20),
    status: assertBranchStatus(branch.status),
  };
};

export function useBranchManagement(groupId: string | null) {
  const queryClient = useQueryClient();

  const invalidateGroup = () => {
    queryClient.invalidateQueries({ queryKey: ['restaurant-group', groupId] });
    queryClient.invalidateQueries({ queryKey: ['group-analytics', groupId] });
    queryClient.invalidateQueries({ queryKey: ['group-orders', groupId] });
    queryClient.invalidateQueries({ queryKey: ['menu-items'] });
  };

  const createBranch = useMutation({
    mutationFn: async (branch: BranchPayload & { owner_id: string | null }) => {
      if (!groupId) throw new Error('Group ID is required');
      const clean = sanitizeBranchPayload(branch);
      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          name: clean.name,
          address: clean.address,
          branch_code: clean.branch_code,
          phone: clean.phone,
          status: clean.status,
          group_id: groupId,
          is_branch: true,
          owner_id: branch.owner_id,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateGroup,
  });

  const updateBranch = useMutation({
    mutationFn: async ({ id, ...branch }: BranchPayload & { id: string }) => {
      const clean = sanitizeBranchPayload(branch);
      const { error } = await supabase
        .from('restaurants')
        .update(clean)
        .eq('id', id)
        .eq('group_id', groupId);
      if (error) throw error;
    },
    onSuccess: invalidateGroup,
  });

  const setBranchStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const safeStatus = assertBranchStatus(status); // blocks arbitrary strings
      const { error } = await supabase
        .from('restaurants')
        .update({ status: safeStatus })
        .eq('id', id)
        .eq('group_id', groupId);
      if (error) throw error;
    },
    onSuccess: invalidateGroup,
  });

  return { createBranch, updateBranch, setBranchStatus };
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
  return useQuery<LiveOrder[]>({
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

/** Sanitize shared menu item before DB write */
const sanitizeMenuItem = (
  item: Omit<SharedMenuItem, 'id' | 'created_at' | 'updated_at'>,
): Omit<SharedMenuItem, 'id' | 'created_at' | 'updated_at'> => {
  const name = item.name.trim().slice(0, 200);
  if (!name) throw new Error('Item name is required');
  const price = Number(item.price);
  if (!Number.isFinite(price) || price < 0) throw new Error('Invalid price');
  return {
    group_id: item.group_id,
    name,
    category: (item.category || 'সাধারণ').trim().slice(0, 100),
    description: sanitizeText(item.description, 1000),
    price: Math.round(price * 100) / 100, // 2 decimal places
    image_url: sanitizeText(item.image_url, 2048),
    is_active: Boolean(item.is_active),
  };
};

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
      const clean = sanitizeMenuItem(item);
      const { data, error } = await supabase
        .from('group_shared_menus')
        .insert(clean)
        .select()
        .single();
      if (error) throw error;
      return data as SharedMenuItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-menu', groupId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SharedMenuItem> & { id: string }) => {
      // Only sanitize provided fields
      const cleanPatch: Partial<SharedMenuItem> = {};
      if (patch.name !== undefined) {
        const n = patch.name.trim().slice(0, 200);
        if (!n) throw new Error('Item name is required');
        cleanPatch.name = n;
      }
      if (patch.category !== undefined) cleanPatch.category = patch.category.trim().slice(0, 100) || 'সাধারণ';
      if (patch.description !== undefined) cleanPatch.description = sanitizeText(patch.description, 1000);
      if (patch.price !== undefined) {
        const p = Number(patch.price);
        if (!Number.isFinite(p) || p < 0) throw new Error('Invalid price');
        cleanPatch.price = Math.round(p * 100) / 100;
      }
      if (patch.image_url !== undefined) cleanPatch.image_url = sanitizeText(patch.image_url, 2048);
      if (patch.is_active !== undefined) cleanPatch.is_active = Boolean(patch.is_active);

      const { error } = await supabase.from('group_shared_menus').update(cleanPatch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-menu', groupId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('group_shared_menus').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-menu', groupId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
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
    mutationFn: async (override: Omit<BranchOverride, 'id'>) => {
      const custom_price =
        override.custom_price !== null ? Math.round(Number(override.custom_price) * 100) / 100 : null;
      if (custom_price !== null && (!Number.isFinite(custom_price) || custom_price < 0)) {
        throw new Error('Invalid custom price');
      }
      const { error } = await supabase
        .from('branch_menu_overrides')
        .upsert(
          { ...override, custom_price },
          { onConflict: 'restaurant_id,shared_menu_item_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branch-overrides', restaurantId] }),
  });

  return { ...query, upsertOverride };
}
