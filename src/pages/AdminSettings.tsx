import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Store, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminSettings = () => {
  const { user, restaurantId } = useAuth();

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Restaurant state
  const [restName, setRestName] = useState("");
  const [restAddress, setRestAddress] = useState("");
  const [restPhone, setRestPhone] = useState("");
  const [restSaving, setRestSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Load profile
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setProfileName(data.full_name || "");
        setProfileEmail(data.email || "");
        setProfilePhone(data.phone || "");
      }
    });
    // Load restaurant
    if (restaurantId) {
      supabase.from("restaurants").select("*").eq("id", restaurantId).single().then(({ data }) => {
        if (data) {
          setRestName(data.name || "");
          setRestAddress(data.address || "");
          setRestPhone(data.phone || "");
        }
      });
    }
  }, [user, restaurantId]);

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: profileName, phone: profilePhone, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("প্রোফাইল আপডেট হয়েছে");
    } catch (err: any) {
      toast.error(err.message || "আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setProfileSaving(false);
    }
  };

  const saveRestaurant = async () => {
    if (!restaurantId) return;
    setRestSaving(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ name: restName, address: restAddress, phone: restPhone, updated_at: new Date().toISOString() })
        .eq("id", restaurantId);
      if (error) throw error;
      toast.success("রেস্টুরেন্ট তথ্য আপডেট হয়েছে");
    } catch (err: any) {
      toast.error(err.message || "আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setRestSaving(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="সেটিংস">
      <div className="max-w-2xl space-y-6 animate-fade-up">
        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" className="flex items-center gap-2"><User className="w-4 h-4" /> প্রোফাইল</TabsTrigger>
            <TabsTrigger value="restaurant" className="flex items-center gap-2"><Store className="w-4 h-4" /> রেস্টুরেন্ট</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">অ্যাকাউন্ট প্রোফাইল</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>পুরো নাম</Label>
                  <Input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="আপনার নাম" />
                </div>
                <div className="space-y-2">
                  <Label>ইমেইল</Label>
                  <Input value={profileEmail} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">ইমেইল পরিবর্তন করা যায় না</p>
                </div>
                <div className="space-y-2">
                  <Label>ফোন নম্বর</Label>
                  <Input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+880..." />
                </div>
                <Button variant="hero" onClick={saveProfile} disabled={profileSaving} className="w-full">
                  {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {profileSaving ? "সেভ হচ্ছে..." : "প্রোফাইল সেভ করুন"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="restaurant">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">রেস্টুরেন্ট তথ্য</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>রেস্টুরেন্টের নাম</Label>
                  <Input value={restName} onChange={e => setRestName(e.target.value)} placeholder="রেস্টুরেন্টের নাম" />
                </div>
                <div className="space-y-2">
                  <Label>ঠিকানা</Label>
                  <Input value={restAddress} onChange={e => setRestAddress(e.target.value)} placeholder="ঠিকানা" />
                </div>
                <div className="space-y-2">
                  <Label>ফোন নম্বর</Label>
                  <Input value={restPhone} onChange={e => setRestPhone(e.target.value)} placeholder="+880..." />
                </div>
                <Button variant="hero" onClick={saveRestaurant} disabled={restSaving} className="w-full">
                  {restSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {restSaving ? "সেভ হচ্ছে..." : "রেস্টুরেন্ট তথ্য সেভ করুন"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettings;
