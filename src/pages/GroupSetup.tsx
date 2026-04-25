import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, ChevronRight, CheckCircle2, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useUserGroups } from '@/hooks/useGroupOwner';
import { useQueryClient } from '@tanstack/react-query';

type Step = 1 | 2 | 3;

interface GroupForm {
  name: string;
  description: string;
}

interface BranchForm {
  name: string;
  address: string;
  branch_code: string;
  phone: string;
}

const STEP_LABELS: Record<Step, string> = {
  1: 'গ্রুপ তৈরি',
  2: 'প্রথম শাখা',
  3: 'সম্পন্ন',
};

export default function GroupSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [groupForm, setGroupForm] = useState<GroupForm>({ name: '', description: '' });
  const [branchForm, setBranchForm] = useState<BranchForm>({
    name: '', address: '', branch_code: 'BR-01', phone: '',
  });

  const { data: existingGroups = [], isLoading: groupsLoading } = useUserGroups();

  const handleCreateGroup = async () => {
    if (!groupForm.name.trim()) { toast.error('গ্রুপের নাম দেওয়া আবশ্যক'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_groups')
        .insert({ name: groupForm.name.trim(), description: groupForm.description || null, owner_id: user?.id })
        .select('id')
        .single();
      if (error) throw error;
      setCreatedGroupId(data.id);
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success('গ্রুপ তৈরি হয়েছে');
      setStep(2);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!branchForm.name.trim() || !createdGroupId) { toast.error('শাখার নাম দেওয়া আবশ্যক'); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .insert({
          name: branchForm.name.trim(),
          address: branchForm.address || null,
          branch_code: branchForm.branch_code || null,
          phone: branchForm.phone || null,
          group_id: createdGroupId,
          is_branch: true,
          owner_id: user?.id,
          status: 'active',
        });
      if (error) throw error;
      toast.success('শাখা যোগ হয়েছে');
      setStep(3);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const skipBranch = () => setStep(3);

  return (
    <DashboardLayout role="admin" title="রেস্টুরেন্ট গ্রুপ সেটআপ">
      <div className="max-w-xl mx-auto space-y-6 animate-fade-up">

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {([1, 2, 3] as Step[]).map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                step > s
                  ? 'bg-success border-success text-success-foreground'
                  : step === s
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-background border-border text-muted-foreground'
              }`}>
                {step > s ? <CheckCircle2 className="w-3.5 h-3.5" /> : s}
              </div>
              <span className={`text-xs font-medium ${step === s ? 'text-foreground' : 'text-muted-foreground'}`}>
                {STEP_LABELS[s]}
              </span>
              {idx < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Existing groups (if any) */}
        {step === 1 && existingGroups.length > 0 && (
          <Card className="border-primary/20 bg-primary/3">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold">আপনার বিদ্যমান গ্রুপসমূহ</p>
              {groupsLoading ? (
                <p className="text-xs text-muted-foreground">লোড হচ্ছে...</p>
              ) : (
                existingGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => navigate(`/group/${g.id}`)}
                    className="w-full flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{g.name}</p>
                      {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                  </button>
                ))
              )}
              <p className="text-xs text-muted-foreground pt-1">অথবা নিচে নতুন গ্রুপ তৈরি করুন</p>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Create Group */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                গ্রুপের তথ্য দিন
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>গ্রুপের নাম *</Label>
                <Input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="যেমন: পান্শি রেস্টুরেন্ট গ্রুপ"
                />
              </div>
              <div className="space-y-1.5">
                <Label>বিবরণ (ঐচ্ছিক)</Label>
                <Textarea
                  rows={2}
                  value={groupForm.description}
                  onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="সংক্ষিপ্ত বিবরণ..."
                  className="resize-none"
                />
              </div>
              <Button onClick={handleCreateGroup} disabled={saving} className="w-full gap-2">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                গ্রুপ তৈরি করুন <ChevronRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Create First Branch */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
                প্রথম শাখা যোগ করুন
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>শাখার নাম *</Label>
                  <Input
                    value={branchForm.name}
                    onChange={(e) => setBranchForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="যেমন: মতিঝিল শাখা"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>শাখা কোড</Label>
                  <Input
                    value={branchForm.branch_code}
                    onChange={(e) => setBranchForm((p) => ({ ...p, branch_code: e.target.value }))}
                    placeholder="BR-01"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ফোন</Label>
                  <Input
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>ঠিকানা</Label>
                  <Input
                    value={branchForm.address}
                    onChange={(e) => setBranchForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="শাখার ঠিকানা"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateBranch} disabled={saving} className="flex-1 gap-2">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  শাখা যোগ করুন
                </Button>
                <Button variant="outline" onClick={skipBranch}>পরে করুন</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <Card className="border-success/20 bg-success/5">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-success">সেটআপ সম্পন্ন!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  আপনার রেস্টুরেন্ট গ্রুপ তৈরি হয়েছে। এখন ড্যাশবোর্ড থেকে সব শাখা পরিচালনা করুন।
                </p>
              </div>
              <Button
                className="gap-2"
                onClick={() => createdGroupId ? navigate(`/group/${createdGroupId}`) : navigate('/admin')}
              >
                গ্রুপ ড্যাশবোর্ডে যান <ChevronRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
