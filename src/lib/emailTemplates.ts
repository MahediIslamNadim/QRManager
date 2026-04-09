// emailTemplates.ts - Email notification templates
import { format } from 'date-fns';
import { TIERS, formatPrice, TierName } from '@/constants/tiers';

// Base email wrapper
const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #f5d780, #c9a84c);
      color: #0a0a0a;
      padding: 30px;
      text-align: center;
      border-radius: 12px 12px 0 0;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-radius: 0 0 12px 12px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #f5d780, #c9a84c);
      color: #0a0a0a;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 16px 0;
    }
    .info-box {
      background: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }
    .warning-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }
    .success-box {
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">QR Manager</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.8;">Restaurant Management System</p>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} QR Manager by NexCore Ltd.</p>
    <p>
      <a href="https://qrmanager.com" style="color: #6b7280;">Website</a> | 
      <a href="https://qrmanager.com/support" style="color: #6b7280;">Support</a> | 
      <a href="https://qrmanager.com/unsubscribe" style="color: #6b7280;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
`;

// Welcome email (after signup)
export const welcomeEmail = (restaurantName: string, trialDays: number) => emailWrapper(`
  <h2>Welcome to QR Manager! 🎉</h2>
  <p>Hi there,</p>
  <p>Thank you for signing up for QR Manager! We're excited to have <strong>${restaurantName}</strong> on board.</p>
  
  <div class="success-box">
    <strong>Your ${trialDays}-day free trial has started!</strong>
    <p style="margin: 8px 0 0 0;">You now have full access to all features. No credit card required.</p>
  </div>

  <h3>What's next?</h3>
  <ul>
    <li><strong>Set up your menu</strong> - Add your dishes and prices</li>
    <li><strong>Create QR codes</strong> - Generate table QR codes for customers</li>
    <li><strong>Start taking orders</strong> - Customers can scan and order instantly</li>
  </ul>

  <a href="https://qrmanager.com/dashboard" class="button">Go to Dashboard →</a>

  <p>Need help getting started? Check out our <a href="https://qrmanager.com/guide">setup guide</a> or reply to this email.</p>

  <p>
    Best regards,<br>
    The QR Manager Team
  </p>
`);

// Trial expiring soon (7 days left)
export const trialExpiringEmail = (
  restaurantName: string,
  daysLeft: number,
  tier: TierName
) => emailWrapper(`
  <h2>Your trial is ending soon ⏰</h2>
  <p>Hi ${restaurantName},</p>
  
  <div class="warning-box">
    <strong>Your free trial expires in ${daysLeft} days</strong>
    <p style="margin: 8px 0 0 0;">Don't lose access to your QR ordering system!</p>
  </div>

  <p>To continue using QR Manager after your trial ends, please choose a plan:</p>

  <div class="info-box">
    <strong>${TIERS[tier].displayName}</strong><br>
    From ${formatPrice(TIERS[tier].priceMonthly)}/month<br>
    <small>Save 20% with annual billing</small>
  </div>

  <a href="https://qrmanager.com/upgrade" class="button">Upgrade Now →</a>

  <p><strong>What happens if my trial expires?</strong><br>
  Your data will be safe, but you won't be able to take orders until you subscribe.</p>

  <p>
    Questions? Reply to this email anytime.<br>
    The QR Manager Team
  </p>
`);

// Trial expired
export const trialExpiredEmail = (restaurantName: string) => emailWrapper(`
  <h2>Your trial has ended</h2>
  <p>Hi ${restaurantName},</p>
  
  <p>Your 30-day free trial of QR Manager has ended. We hope you enjoyed exploring the platform!</p>

  <div class="warning-box">
    <strong>Action Required</strong>
    <p style="margin: 8px 0 0 0;">To continue using QR Manager, please upgrade to a paid plan. Your data is safe and ready when you return.</p>
  </div>

  <a href="https://qrmanager.com/upgrade" class="button">Choose a Plan →</a>

  <p>All your menu items, tables, and settings are preserved. Simply upgrade to regain full access.</p>

  <p>
    Need help deciding? We're here for you!<br>
    The QR Manager Team
  </p>
`);

// Subscription activated
export const subscriptionActivatedEmail = (
  restaurantName: string,
  tier: TierName,
  billingCycle: string,
  amount: number,
  nextBillingDate: Date
) => emailWrapper(`
  <h2>Welcome to ${TIERS[tier].displayName}! 🎉</h2>
  <p>Hi ${restaurantName},</p>
  
  <div class="success-box">
    <strong>Your subscription is now active!</strong>
    <p style="margin: 8px 0 0 0;">Thank you for choosing QR Manager.</p>
  </div>

  <h3>Subscription Details</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px 0;"><strong>Plan:</strong></td>
      <td style="text-align: right;">${TIERS[tier].displayName}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0;"><strong>Billing:</strong></td>
      <td style="text-align: right;">${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0;"><strong>Amount:</strong></td>
      <td style="text-align: right;"><strong>${formatPrice(amount)}</strong></td>
    </tr>
    <tr>
      <td style="padding: 8px 0;"><strong>Next billing:</strong></td>
      <td style="text-align: right;">${format(nextBillingDate, 'MMM dd, yyyy')}</td>
    </tr>
  </table>

  <a href="https://qrmanager.com/billing" class="button">View Billing →</a>

  <p>
    Thank you for your trust!<br>
    The QR Manager Team
  </p>
`);

// Payment received
export const paymentReceivedEmail = (
  restaurantName: string,
  amount: number,
  invoiceNumber: string,
  date: Date
) => emailWrapper(`
  <h2>Payment Received ✅</h2>
  <p>Hi ${restaurantName},</p>
  
  <div class="success-box">
    <strong>We've received your payment</strong>
    <p style="margin: 8px 0 0 0;">Thank you! Your subscription continues uninterrupted.</p>
  </div>

  <h3>Payment Details</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px 0;"><strong>Amount:</strong></td>
      <td style="text-align: right;">${formatPrice(amount)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0;"><strong>Invoice:</strong></td>
      <td style="text-align: right;">${invoiceNumber}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0;"><strong>Date:</strong></td>
      <td style="text-align: right;">${format(date, 'MMM dd, yyyy')}</td>
    </tr>
  </table>

  <a href="https://qrmanager.com/billing" class="button">Download Invoice →</a>

  <p>
    Questions about this payment? Contact us anytime.<br>
    The QR Manager Team
  </p>
`);

// Payment failed
export const paymentFailedEmail = (
  restaurantName: string,
  amount: number,
  nextAttempt: Date
) => emailWrapper(`
  <h2>Payment Issue ⚠️</h2>
  <p>Hi ${restaurantName},</p>
  
  <div class="warning-box">
    <strong>We couldn't process your payment</strong>
    <p style="margin: 8px 0 0 0;">Amount: ${formatPrice(amount)}</p>
  </div>

  <p>Don't worry - your subscription is still active. We'll try again on ${format(nextAttempt, 'MMM dd, yyyy')}.</p>

  <h3>What you can do:</h3>
  <ul>
    <li>Update your payment method</li>
    <li>Check if your card has sufficient funds</li>
    <li>Contact your bank if the issue persists</li>
  </ul>

  <a href="https://qrmanager.com/billing" class="button">Update Payment Method →</a>

  <p>
    Need help? We're here for you!<br>
    The QR Manager Team
  </p>
`);

// Subscription cancelled
export const subscriptionCancelledEmail = (
  restaurantName: string,
  endDate: Date
) => emailWrapper(`
  <h2>Subscription Cancelled</h2>
  <p>Hi ${restaurantName},</p>
  
  <p>We've processed your cancellation request. We're sorry to see you go!</p>

  <div class="info-box">
    <strong>Your access continues until ${format(endDate, 'MMM dd, yyyy')}</strong>
    <p style="margin: 8px 0 0 0;">You can reactivate anytime before this date.</p>
  </div>

  <p><strong>What happens next?</strong></p>
  <ul>
    <li>Full access until ${format(endDate, 'MMM dd, yyyy')}</li>
    <li>No further charges</li>
    <li>Data stored for 30 days after expiration</li>
  </ul>

  <a href="https://qrmanager.com/feedback" class="button">Give Feedback →</a>

  <p>Changed your mind? You can reactivate anytime from your dashboard.</p>

  <p>
    Thank you for using QR Manager!<br>
    The QR Manager Team
  </p>
`);

// Export all templates
export const EMAIL_TEMPLATES = {
  welcome: welcomeEmail,
  trialExpiring: trialExpiringEmail,
  trialExpired: trialExpiredEmail,
  subscriptionActivated: subscriptionActivatedEmail,
  paymentReceived: paymentReceivedEmail,
  paymentFailed: paymentFailedEmail,
  subscriptionCancelled: subscriptionCancelledEmail
};
