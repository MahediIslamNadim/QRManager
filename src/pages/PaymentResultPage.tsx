import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PaymentResultPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get("status") ?? "failed";
  const reason = params.get("reason");

  const config = {
    success: {
      icon: <CheckCircle2 className="w-16 h-16 text-success" />,
      bg: "bg-success/10",
      title: "পেমেন্ট সফল হয়েছে!",
      message: "আপনার সাবস্ক্রিপশন সক্রিয় হয়েছে। ড্যাশবোর্ডে ফিরে যান এবং সব ফিচার উপভোগ করুন।",
      btnLabel: "ড্যাশবোর্ডে যান",
      btnAction: () => navigate("/admin"),
      btnVariant: "hero" as const,
    },
    failed: {
      icon: <XCircle className="w-16 h-16 text-destructive" />,
      bg: "bg-destructive/10",
      title: "পেমেন্ট ব্যর্থ হয়েছে",
      message: "কোনো কারণে পেমেন্ট সম্পন্ন হয়নি। আবার চেষ্টা করুন অথবা অন্য পদ্ধতি ব্যবহার করুন।",
      btnLabel: "আবার চেষ্টা করুন",
      btnAction: () => navigate("/admin/upgrade"),
      btnVariant: "default" as const,
    },
    cancelled: {
      icon: <AlertCircle className="w-16 h-16 text-warning" />,
      bg: "bg-warning/10",
      title: "পেমেন্ট বাতিল করা হয়েছে",
      message: "আপনি পেমেন্ট বাতিল করেছেন। যেকোনো সময় আবার চেষ্টা করতে পারবেন।",
      btnLabel: "প্ল্যান পেজে যান",
      btnAction: () => navigate("/admin/upgrade"),
      btnVariant: "outline" as const,
    },
  }[status] ?? {
    icon: <XCircle className="w-16 h-16 text-destructive" />,
    bg: "bg-destructive/10",
    title: "অজানা ত্রুটি",
    message: "কিছু একটা সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।",
    btnLabel: "হোমে যান",
    btnAction: () => navigate("/"),
    btnVariant: "outline" as const,
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className={`w-24 h-24 ${config.bg} rounded-full flex items-center justify-center mx-auto`}>
            {config.icon}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{config.title}</h1>
            <p className="text-muted-foreground">{config.message}</p>
            {reason && (
              <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-1 inline-block">
                কারণ: {reason.replace(/_/g, " ")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <Button variant={config.btnVariant} onClick={config.btnAction} className="w-full">
              {config.btnLabel} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            {status !== "success" && (
              <Button variant="ghost" onClick={() => navigate("/admin")}>
                ড্যাশবোর্ডে ফিরে যান
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentResultPage;
