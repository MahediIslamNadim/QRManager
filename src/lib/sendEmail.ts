// sendEmail.ts - Email sending utility (Supabase Edge Function or Resend)
import { EMAIL_TEMPLATES } from './emailTemplates';

// Email sending service configuration
// In production, use Resend, SendGrid, or Supabase Edge Function with Resend

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Send email using Resend (recommended)
export const sendEmail = async (options: EmailOptions) => {
  try {
    // TODO: Replace with actual Resend API call
    // For now, just log

    console.log('📧 Sending email:', {
      to: options.to,
      subject: options.subject
    });

    // In production, use Resend:
    /*
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'QR Manager <noreply@qrmanager.com>',
        to: options.to,
        subject: options.subject,
        html: options.html
      })
    });

    if (!response.ok) {
      throw new Error('Email send failed');
    }

    return await response.json();
    */

    return { success: true, message: 'Email queued (development mode)' };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

// Helper functions for specific email types
export const sendWelcomeEmail = async (
  email: string,
  restaurantName: string,
  trialDays: number
) => {
  return sendEmail({
    to: email,
    subject: `Welcome to QR Manager! Your ${trialDays}-day trial has started 🎉`,
    html: EMAIL_TEMPLATES.welcome(restaurantName, trialDays)
  });
};

export const sendTrialExpiringEmail = async (
  email: string,
  restaurantName: string,
  daysLeft: number,
  tier: any
) => {
  return sendEmail({
    to: email,
    subject: `Your trial expires in ${daysLeft} days ⏰`,
    html: EMAIL_TEMPLATES.trialExpiring(restaurantName, daysLeft, tier)
  });
};

export const sendTrialExpiredEmail = async (
  email: string,
  restaurantName: string
) => {
  return sendEmail({
    to: email,
    subject: 'Your QR Manager trial has ended',
    html: EMAIL_TEMPLATES.trialExpired(restaurantName)
  });
};

export const sendSubscriptionActivatedEmail = async (
  email: string,
  restaurantName: string,
  tier: any,
  billingCycle: string,
  amount: number,
  nextBillingDate: Date
) => {
  return sendEmail({
    to: email,
    subject: `Welcome to ${tier.displayName}! 🎉`,
    html: EMAIL_TEMPLATES.subscriptionActivated(
      restaurantName,
      tier,
      billingCycle,
      amount,
      nextBillingDate
    )
  });
};

export const sendPaymentReceivedEmail = async (
  email: string,
  restaurantName: string,
  amount: number,
  invoiceNumber: string,
  date: Date
) => {
  return sendEmail({
    to: email,
    subject: `Payment received - Invoice ${invoiceNumber} ✅`,
    html: EMAIL_TEMPLATES.paymentReceived(restaurantName, amount, invoiceNumber, date)
  });
};

export const sendPaymentFailedEmail = async (
  email: string,
  restaurantName: string,
  amount: number,
  nextAttempt: Date
) => {
  return sendEmail({
    to: email,
    subject: 'Payment Issue - Action Required ⚠️',
    html: EMAIL_TEMPLATES.paymentFailed(restaurantName, amount, nextAttempt)
  });
};

export const sendSubscriptionCancelledEmail = async (
  email: string,
  restaurantName: string,
  endDate: Date
) => {
  return sendEmail({
    to: email,
    subject: 'Subscription Cancelled',
    html: EMAIL_TEMPLATES.subscriptionCancelled(restaurantName, endDate)
  });
};
