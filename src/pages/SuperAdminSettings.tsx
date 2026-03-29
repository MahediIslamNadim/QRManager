import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SuperAdminSettings = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setName(data.full_name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
      }
    });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name, phone, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("প্রোফাইল আপডেট হয়েছে");
    } catch (err: any) {
      toast.error(err.message || "আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="super_admin" title="সেটিংস">
      <div className="max-w-2xl space-y-6 animate-fade-up">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> অ্যাকাউন্ট প্রোফাইল
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>পুরো নাম</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="আপনার নাম" />
            </div>
            <div className="space-y-2">
              <Label>ইমেইল</Label>
              <Input value={email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">ইমেইল পরিবর্তন করা যায় না</p>
            </div>
            <div className="space-y-2">
              <Label>ফোন নম্বর</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+880..." />
            </div>
            <Button variant="hero" onClick={saveProfile} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "সেভ হচ্ছে..." : "প্রোফাইল সেভ করুন"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminSettings;
