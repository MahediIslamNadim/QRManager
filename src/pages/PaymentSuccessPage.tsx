// PaymentSuccessPage.tsx - Payment confirmation and success
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, Download } from 'lucide-react';
import { TIERS, TierName } from '@/constants/tiers';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tier = (searchParams.get('tier') || 'medium_smart') as TierName;
  const tierConfig = TIERS[tier];

  useEffect(() => {
    // Confetti or celebration animation could go here
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-success/5 to-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardContent className="p-8 text-center space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-success" />
            </div>
          </div>

          {/* Success Message */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-success">Payment Successful!</h1>
            <p className="text-lg text-muted-foreground">
              Welcome to <strong>{tierConfig.displayName}</strong>
            </p>
          </div>

          {/* Confirmation Details */}
          <div className="bg-muted/50 rounded-lg p-6 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="font-semibold">{tierConfig.displayName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="font-semibold text-success">Active</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Next Billing</span>
              <span className="font-semibold">
                {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span>Your subscription is now active and all features are unlocked</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span>A confirmation email has been sent to your inbox</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span>You can manage your subscription anytime from Settings</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="hero"
              className="flex-1"
              size="lg"
              onClick={() => navigate('/admin')}
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={() => {
                // TODO: Generate and download invoice
                alert('Invoice download coming soon!');
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
          </div>

          {/* Support */}
          <p className="text-xs text-muted-foreground">
            Need help? Contact us at{' '}
            <a href="mailto:support@qrmanager.com" className="text-primary hover:underline">
              support@qrmanager.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
