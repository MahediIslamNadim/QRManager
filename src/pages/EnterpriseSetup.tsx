import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEnterpriseContext, useBootstrapEnterprise } from "@/hooks/useEnterpriseAdmin";

export default function EnterpriseSetup() {
  const navigate = useNavigate();
  const { headOffice, groupId, loading, restaurantId } = useEnterpriseContext();
  const bootstrapMutation = useBootstrapEnterprise();

  useEffect(() => {
    if (!loading && groupId) {
      navigate("/enterprise/dashboard", { replace: true });
    }
  }, [groupId, loading, navigate]);

  const handleBootstrap = async () => {
    if (!restaurantId) return;

    try {
      await bootstrapMutation.mutateAsync({
        restaurantId,
        groupName: headOffice?.name || undefined,
      });
      toast.success("Enterprise workspace is ready.");
      navigate("/enterprise/dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not finish enterprise setup.";
      toast.error(message);
    }
  };

  return (
    <DashboardLayout role="group_owner" title="Enterprise Setup">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              Finish enterprise bootstrap
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              This step creates or reconnects the head-office group for your enterprise account.
              After that, your enterprise dashboard, restaurant management, shared menus, notices,
              and analytics will work from one place.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Head office</p>
                <p className="mt-1 font-semibold">{headOffice?.name || "Enterprise account"}</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Access model</p>
                <p className="mt-1 font-semibold">Single group owner</p>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                What happens next
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>One enterprise group will be ensured for your head office.</li>
                <li>Your head office restaurant stays separate from managed branch restaurants.</li>
                <li>Managed locations, shared menus, notices, and analytics will use the enterprise workspace.</li>
              </ul>
            </div>

            <Button
              className="w-full"
              disabled={!restaurantId || bootstrapMutation.isPending}
              onClick={handleBootstrap}
            >
              {bootstrapMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing enterprise workspace...
                </>
              ) : (
                "Complete setup"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
