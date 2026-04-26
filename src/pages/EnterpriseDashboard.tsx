// EnterpriseDashboard.tsx
// Enterprise group owner-এর main dashboard
// Updated: April 26, 2026 — admin → group_owner accounts, navigation updated

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, Settings, UserPlus,
  ArrowRight, Store, BarChart3, RefreshCw, MapPin,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserGroups } from '@/hooks/useGroupOwner';

interface GroupOwnerAccount {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export default function EnterpriseDashboard() {
  const { user, restaurantId, restaurantPlan } = useAuth();
  const navigate = useNavigate();
  const { data: groups = [], isLoading: groupsLoading } = useUserGroups();

  // Fetch restaurant info
  const { data: restaurant } = useQuery({
    queryKey: ['enterprise-restaurant', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();
      return data;
    },
    enabled: !!restaurantId,
  });

  // Fetch other group_owner accounts (excludes self)
  const { data: coOwners = [], isLoading } = useQuery<GroupOwnerAccount[]>({
    queryKey: ['enterprise-co-owners', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'group_owner');

      if (!roles || roles.length === 0) return [];

      const otherIds = roles.map(r => r.user_id).filter(id => id !== user.id);
      if (otherIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .in('id', otherIds);

      return (profiles || []) as GroupOwnerAccount[];
    },
    enabled: !!user?.id,
  });

  const quickActions = [
    {
      icon: UserPlus,
      label: 'Group Owner যোগ করুন',
      desc: 'নতুন Group Owner অ্যাকাউন্ট তৈরি করুন',
      color: 'bg-primary/10 text-primary',
      onClick: () => navigate('/enterprise/setup'),
    },
    {
      icon: MapPin,
      label: 'Multi-Location',
      desc: 'গ্রুপ ও শাখা পরিচালনা করুন',
      color: 'bg-amber-500/10 text-amber-500',
      onClick: () => {
        if (groups.length > 0) navigate(`/group/${groups[0].id}`);
        else navigate('/group/setup');
      },
    },
    {
      icon: Store,
      label: 'রেস্টুরেন্ট দেখুন',
      desc: 'মেনু, অর্ডার, টেবিল পরিচালনা',
      color: 'bg-success/10 text-success',
      onClick: () => navigate('/admin'),
    },
    {
      icon: BarChart3,
      label: 'Analytics',
      desc: 'বিক্রয় ও পরিসংখ্যান দেখুন',
      color: 'bg-blue-500/10 text-blue-500',
      onClick: () => navigate('/admin/analytics'),
    },
    {
      icon: Settings,
      label: 'সেটিংস',
      desc: 'প্রোফাইল ও রেস্টুরেন্ট আপডেট',
      color: 'bg-purple-500/10 text-purple-500',
      onClick: () => navigate('/admin/settings'),
    },
  ];

  return (
    <DashboardLayout role="group_owner" title="Enterprise Dashboard">
      <div className="space-y-6 animate-fade-up">

        {/* Welcome banner */}
        <Card className="border-amber-400/30 bg-amber-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">{restaurant?.name || 'আপনার রেস্টুরেন্ট'}</h2>
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-400/30 border text-[10px]">
                    🏢 Enterprise
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  আনলিমিটেড Group Owner • সম্পূর্ণ নিয়ন্ত্রণ
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Groups section */}
        {(groups.length > 0 || groupsLoading) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" /> রেস্টুরেন্ট গ্রুপসমূহ
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => navigate('/group/setup')} className="gap-1.5 text-xs">
                <UserPlus className="w-3.5 h-3.5" /> নতুন গ্রুপ
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {groupsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
                </div>
              ) : (
                groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => navigate(`/group/${g.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/40 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{g.name}</p>
                      {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? '...' : coOwners.length}</p>
                <p className="text-xs text-muted-foreground">Co-Owners</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groups.length || '∞'}</p>
                <p className="text-xs text-muted-foreground">{groups.length ? 'গ্রুপ' : 'আনলিমিটেড'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">দ্রুত অ্যাকশন</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className="flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-secondary/40 transition-colors text-left"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${action.color}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Co-owner list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Group Owner অ্যাকাউন্টসমূহ
            </CardTitle>
            <Button
              size="sm" variant="outline"
              onClick={() => navigate('/enterprise/setup')}
              className="gap-1.5 text-xs"
            >
              <UserPlus className="w-3.5 h-3.5" /> Owner যোগ করুন
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
              </div>
            ) : coOwners.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <Users className="w-10 h-10 mx-auto text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">কোনো Co-Owner নেই</p>
                <Button size="sm" onClick={() => navigate('/enterprise/setup')} className="gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Group Owner তৈরি করুন
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {coOwners.map(acc => (
                  <div key={acc.id} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center font-bold text-amber-600 text-sm flex-shrink-0">
                      {(acc.full_name || acc.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{acc.full_name || 'নাম নেই'}</p>
                      <p className="text-xs text-muted-foreground truncate">{acc.email}</p>
                    </div>
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-400/30 border text-[10px] shrink-0">
                      Group Owner
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
