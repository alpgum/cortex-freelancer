# Stripe Tax Configuration — VAT/GST Setup

Guide for configuring Stripe Tax for a UK-based business selling digital services (SaaS).

## 1. Enable Stripe Tax

1. Go to **Stripe Dashboard → Settings → Tax**
2. Click **Get started** to enable Stripe Tax
3. Set your **origin address** to your UK business address
4. Set **Tax registration** status to active

## 2. UK VAT Registration

1. In **Tax → Registrations**, click **Add registration**
2. Select **United Kingdom** → **VAT — Standard**
3. Enter your VAT registration number (format: `GB123456789`)
4. Set the **registration start date** (when you became VAT registered)

### When to Register for VAT
- Mandatory when UK taxable turnover exceeds **£90,000** in the last 12 months
- Voluntary registration is possible at any threshold

## 3. Tax Behaviour

Set default tax behaviour for your products:

- **Inclusive** — prices shown include VAT (recommended for B2C in UK/EU)
- **Exclusive** — VAT added at checkout (common for B2B)

In Stripe Dashboard → Products → select each product → Tax section:
- Set **Tax code**: `txcd_10103001` (SaaS — electronic services)
- Set **Tax behaviour**: `inclusive` or `exclusive`

## 4. International Tax (Digital Services)

As a UK business selling digital services globally, you may need to collect:

### EU Countries
- Register for **VAT OSS (One Stop Shop)** via HMRC if selling B2C to EU customers
- In Stripe, add registrations for **EU — VAT OSS (Non-Union scheme)**
- Rate varies by country (17%–27%)

### United States
- US has no federal VAT/GST
- Sales tax varies by state; Stripe Tax handles this automatically
- Register in states where you have nexus (economic nexus thresholds apply)

### Australia
- **GST** at 10% applies to digital services sold to Australian consumers
- Register for GST with the ATO if turnover exceeds **AUD $75,000**
- Add registration: **Australia → GST**

### Canada
- **GST/HST** varies by province (5%–15%)
- Register if revenue exceeds **CAD $30,000** over 12 months
- Add registration: **Canada → GST/HST**

### India
- **GST** at 18% on digital services (OIDAR)
- Add registration: **India → GST**

## 5. Stripe Tax in Checkout Sessions

Tax is applied automatically when creating checkout sessions:

```javascript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  automatic_tax: { enabled: true },
  customer_email: email,
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: '...',
  cancel_url: '...'
});
```

Key parameter: `automatic_tax: { enabled: true }`

## 6. Tax on Invoices

For subscription invoices, enable automatic tax:

```javascript
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  automatic_tax: { enabled: true }
});
```

## 7. Tax Reporting

- **Stripe Dashboard → Tax → Reporting** provides tax summaries by jurisdiction
- Export reports for quarterly VAT returns (UK: MTD-compatible)
- Reports available: tax collected, tax by region, transaction-level detail

## 8. Checklist

- [ ] Enable Stripe Tax in dashboard
- [ ] Set origin address (UK business address)
- [ ] Add UK VAT registration with VAT number
- [ ] Set tax code `txcd_10103001` on all products
- [ ] Choose tax behaviour (inclusive/exclusive)
- [ ] Add `automatic_tax: { enabled: true }` to checkout sessions
- [ ] Register for EU VAT OSS if selling B2C to EU
- [ ] Register in other countries as thresholds are met
- [ ] Verify tax appears correctly on test invoices
- [ ] Set up quarterly reporting exports
