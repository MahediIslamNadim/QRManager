// useBranchInvite.ts — Branch admin invitation system
// Created: April 25, 2026
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BranchInvitation {
  id: string;
  group_id: string;
  restaurant_id: string;
  invited_email: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  accepted_at: string | null;
}

// Fetch all invitations for a group
export function useBranchInvitations(groupId: string | null) {
  return useQuery<BranchInvitation[]>({
    queryKey: ['branch-invitations', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await (supabase.from('branch_invitations') as any)
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      if (error) {
        // Table may not exist yet — return empty gracefully
        console.warn('branch_invitations table not found:', error.message);
        return [];
      }
      return data ?? [];
    },
    enabled: !!groupId,
  });
}

// Send an invitation to a branch admin
export function useInviteBranchAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      restaurantId,
      groupId,
      email,
    }: {
      restaurantId: string;
      groupId: string;
      email: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('invite-branch-admin', {
        body: { restaurant_id: restaurantId, group_id: groupId, email },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('আমন্ত্রণ পাঠানো হয়েছে!');
      queryClient.invalidateQueries({ queryKey: ['branch-invitations', variables.groupId] });
    },
    onError: (err: any) => {
      // If edge function not deployed yet, show helpful message
      const msg = err.message || 'আমন্ত্রণ পাঠানো যায়নি';
      if (msg.includes('not found') || msg.includes('404') || msg.includes('Function')) {
        toast.error('Edge function deploy করা হয়নি। supabase functions deploy invite-branch-admin চালান।');
      } else {
        toast.error(msg);
      }
    },
  });
}
