import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useIsGroupOwner() {
  const { role } = useAuth();
  return role === 'group_owner' || role === 'super_admin';
}

export interface RestaurantGroup {
  id: string;
  name: string;
  owner_id: string | null;
  logo_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useUserGroups() {
  const { user } = useAuth();

  return useQuery<RestaurantGroup[]>({
    queryKey: ['user-groups', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('restaurant_groups')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RestaurantGroup[];
    },
    enabled: !!user,
  });
}
