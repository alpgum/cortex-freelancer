# Stripe Receipt Email Configuration

How to enable and customize receipt emails in Stripe for Cortex Freelancer.

---

## 1. Enable Receipt Emails

1. Go to **Stripe Dashboard** > **Settings** > **Emails**
2. Under **Customer emails**, enable:
   - **Successful payments**: Send email receipts for successful payments
   - **Refunds**: Send email notifications for refunds
3. Click **Save**

> Stripe automatically sends receipts to the customer email on file for every successful charge.

---

## 2. Branded Email Template

### Customize Branding

1. Go to **Settings** > **Branding**
2. Set the following:
   - **Icon**: Upload the Cortex Freelancer logo (128x128 PNG)
   - **Brand color**: `#ff8844`
   - **Accent color**: `#00ff88`
   - **Business name**: Cortex Freelancer

### Receipt Email Content

Stripe receipts are auto-generated but you can customize the **public business information** that appears:

1. Go to **Settings** > **Public details**
2. Fill in:
   - **Business name**: Cortex Freelancer
   - **Support email**: hello@cortexfreelancer.com
   - **Support URL**: https://cortexfreelancer.com/support
   - **Privacy policy**: https://cortexfreelancer.com/privacy
   - **Terms of service**: https://cortexfreelancer.com/terms

---

## 3. Invoice Emails (for Subscriptions)

Stripe sends invoice emails automatically for recurring subscriptions. To configure:

1. Go to **Settings** > **Emails** > **Invoices**
2. Enable:
   - **Send finalized invoices and credit notes**: On
   - **Invoice PDF**: Attach PDF to email
3. Customize the invoice memo (appears on the PDF):
   ```
   Thank you for subscribing to Cortex Freelancer Pro!
   Your AI business team is ready to help you grow.

   Questions? Contact us at hello@cortexfreelancer.com
   ```

---

## 4. Upcoming Renewal Emails

Stripe can send emails before a subscription renews:

1. Go to **Settings** > **Emails** > **Subscriptions**
2. Enable **Send emails about upcoming renewals**
3. Set timing: **3 days before renewal**

---

## 5. Email Copy Templates

### Welcome Email (send manually or via webhook)

```
Subject: Welcome to Cortex Freelancer Pro!

Hey [NAME],

You're in! Your Cortex Freelancer Pro subscription is now active.

Here's what you've unlocked:
- Unlimited profile analyses
- Invoice generator with PDF export
- AI proposal writer (3 variants)
- 78+ professional templates
- 20 job matches with advanced filters
- Priority support + all future updates

Get started: https://cortexfreelancer.com/app

Need help? Reply to this email or visit our support page.

— The Cortex Team
```

### Cancellation Confirmation

```
Subject: Your Cortex Pro subscription has been cancelled

Hey [NAME],

We've cancelled your Cortex Freelancer Pro subscription as requested.

You'll keep Pro access until the end of your current billing period ([DATE]).
After that, your account will revert to the Free plan.

Changed your mind? You can resubscribe anytime at:
https://cortexfreelancer.com/pricing

We'd love to hear why you cancelled — reply to this email and let us know.

— The Cortex Team
```

---

## 6. Testing

1. Create a test subscription in Stripe Test mode
2. Verify receipt email arrives with correct branding
3. Verify invoice PDF is attached and shows correct business info
4. Verify renewal reminder email fires 3 days before next period
