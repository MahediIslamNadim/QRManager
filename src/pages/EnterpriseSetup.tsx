// EnterpriseSetup.tsx
// Enterprise account setup page — admin account তৈরি করার জন্য
// Created: April 26, 2026

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, UserPlus, CheckCircle2, Eye, EyeOff,
  Trash2, RefreshCw, ArrowRight, Shield, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AdminAccount {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export default function EnterpriseSetup() {
  const { user, restaurantId, restaurantPlan, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Fetch existing admins for this restaurant
  const { data: admins = [], isLoading: adminsLoading } = useQuery<AdminAccount[]>({
    queryKey: ['enterprise-admins', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      // Get user_ids with admin role for this restaurant
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .eq('restaurant_id', restaurantId);

      if (!roles || roles.length === 0) return [];

      // Exclude the group_owner themselves
      const adminIds = roles.map(r => r.user_id).filter(id => id !== user?.id);
      if (adminIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .in('id', adminIds);

      return (profiles || []) as AdminAccount[];
    },
    enabled: !!restaurantId,
  });

  const handleCreateAdmin = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error('সব তথ্য পূরণ করুন');
      return;
    }
    if (password.length < 6) {
      toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-staff', {
        body: {
          action: 'add',
          email: email.trim().toLowerCase(),
          password: password,
          full_name: name.trim(),
          role: 'admin',
          restaurant_id: restaurantId,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(`${name} এর অ্যাকাউন্ট তৈরি হয়েছে!`);
      setName(''); setEmail(''); setPassword('');
      queryClient.invalidateQueries({ queryKey: ['enterprise-admins', restaurantId] });
    } catch (e: any) {
      toast.error(e.message || 'অ্যাকাউন্ট তৈরি করা যায়নি');
    } finally {
      setCreating(false);
    }
  };

  const handleComplete = async () => {
    if (admins.length === 0) {
      toast.error('কমপক্ষে ১টি Admin অ্যাকাউন্ট তৈরি করুন');
      return;
    }
    if (!restaurantId) {
      // group_owner-এর নিজস্ব restaurant না থাকলে সরাসরি enterprise dashboard-এ যাও
      toast.success('Setup সম্পন্ন! Enterprise Dashboard-এ যাচ্ছেন...');
      setTimeout(() => navigate('/enterprise/dashboard'), 800);
      return;
    }
    setCompleting(true);
    try {
      await supabase
        .from('restaurants')
        .update({ status: 'active_paid' } as any)
        .eq('id', restaurantId!);

      toast.success('Setup সম্পন্ন! Enterprise Dashboard-এ যাচ্ছেন...');
      setTimeout(() => navigate('/enterprise/dashboard'), 1000);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCompleting(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminName: string) => {
    if (!window.confirm(`${adminName} এর অ্যাকাউন্ট মুছে ফেলবেন?`)) return;
    try {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'delete', user_id: adminId },
      });
      if (error) throw new Error(error.message);
      toast.success('অ্যাকাউন্ট মুছে ফেলা হয়েছে');
      queryClient.invalidateQueries({ queryKey: ['enterprise-admins', restaurantId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const hasAccess = restaurantPlan === 'high_smart_enterprise' || role === 'group_owner' || role === 'super_admin';
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="p-8 space-y-4">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p className="font-semibold">Enterprise অ্যাক্সেস নেই</p>
            <p className="text-sm text-muted-foreground">এই page-টি শুধুমাত্র Enterprise অ্যাকাউন্টের জন্য।</p>
            <Button onClick={() => navigate('/admin')} className="w-full">Dashboard-এ যান</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="font-bold text-lg">🏢 Enterprise Setup</h1>
            <p className="text-xs text-muted-foreground">Admin অ্যাকাউন্ট তৈরি করুন এবং setup সম্পন্ন করুন</p>
          </div>
          <Badge className="ml-auto bg-amber-500/10 text-amber-600 border-amber-400/30 border">
            Enterprise
          </Badge>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Info banner */}
        <Card className="border-amber-400/30 bg-amber-500/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
              <Shield className="w-4 h-4" /> Enterprise Setup — কীভাবে কাজ করে
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• আপনি Group Admin — সব কিছু control করবেন</li>
              <li>• এখানে Admin অ্যাকাউন্ট তৈরি করুন — তারা restaurant পরিচালনা করবে</li>
              <li>• Admin-রা login করলে তাদের নিজস্ব dashboard দেখবে</li>
              <li>• কমপক্ষে ১টি Admin তৈরি করে Setup সম্পন্ন করতে হবে</li>
              <li>• পরেও যেকোনো সময় নতুন Admin যোগ করা যাবে (unlimited)</li>
            </ul>
          </CardContent>
        </Card>

        {/* Create Admin form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="w-5 h-5 text-primary" />
              নতুন Admin অ্যাকাউন্ট তৈরি করুন
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>পুরো নাম *</Label>
                <Input
                  placeholder="যেমন: মোঃ রহিম"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ইমেইল * (Login ID)</Label>
                <Input
                  type="email"
                  placeholder="admin@restaurant.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>পাসওয়ার্ড * (কমপক্ষে ৬ অক্ষর)</Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="শক্তিশালী পাসওয়ার্ড দিন"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pr-10"
                  onKeyDown={e => e.key === 'Enter' && handleCreateAdmin()}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleCreateAdmin}
              disabled={creating || !name.trim() || !email.trim() || !password.trim()}
              className="w-full gap-2"
            >
              {creating
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> তৈরি হচ্ছে...</>
                : <><UserPlus className="w-4 h-4" /> Admin অ্যাকাউন্ট তৈরি করুন</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Admin list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-primary" />
              তৈরি করা Admin অ্যাকাউন্ট
              {admins.length > 0 && (
                <Badge className="ml-auto bg-success/10 text-success border-success/30 border">
                  {admins.length}টি
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adminsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Users className="w-10 h-10 mx-auto text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">এখনো কোনো Admin তৈরি হয়নি</p>
                <p className="text-xs text-muted-foreground">উপরের form থেকে Admin তৈরি করুন</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {admins.map(admin => (
                  <div key={admin.id} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                      {(admin.full_name || admin.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{admin.full_name || 'নাম নেই'}</p>
                      <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                    </div>
                    <Badge className="bg-success/10 text-success border-success/30 border text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Admin
                    </Badge>
                    <button
                      onClick={() => handleDeleteAdmin(admin.id, admin.full_name || admin.email || 'Admin')}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complete button */}
        <div className="space-y-2">
          {admins.length === 0 && (
            <p className="text-center text-xs text-warning">
              ⚠️ Setup সম্পন্ন করতে কমপক্ষে ১টি Admin তৈরি করুন
            </p>
          )}
          <Button
            onClick={handleComplete}
            disabled={admins.length === 0 || completing}
            className="w-full h-12 gap-2 bg-amber-500 hover:bg-amber-600 text-white text-base font-semibold"
          >
            {completing
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> সম্পন্ন হচ্ছে...</>
              : <><CheckCircle2 className="w-5 h-5" /> Setup সম্পন্ন করুন <ArrowRight className="w-4 h-4" /></>
            }
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            পরেও Settings থেকে Admin যোগ/বাদ দেওয়া যাবে
          </p>
        </div>
      </div>
    </div>
  );
}
