# Stripe Coupon System

How to create, manage, and apply coupon codes for Cortex Freelancer Pro.

---

## 1. Coupon Codes

| Code | Discount | Use Case |
|------|----------|----------|
| `LAUNCH50` | 50% off first month | Launch promotion |
| `FRIEND20` | 20% off first month | Referral / friend discount |
| `ANNUAL10` | 10% off annual plan | Incentivize annual billing |

---

## 2. Create Coupons in Stripe

### LAUNCH50 — 50% Off First Month

1. Go to **Stripe Dashboard** > **Products** > **Coupons** > **Create coupon**
2. Settings:
   - **Name**: Launch 50% Off
   - **Type**: Percentage discount
   - **Percentage off**: 50%
   - **Duration**: Once (first payment only)
   - **Max redemptions**: Set a limit (e.g., 500) or leave unlimited
   - **Redemption deadline**: Set if time-limited
3. Copy the **Coupon ID** and set as `STRIPE_COUPON_LAUNCH50` in Vercel env vars

### FRIEND20 — 20% Off First Month

1. Create another coupon:
   - **Name**: Friend 20% Off
   - **Percentage off**: 20%
   - **Duration**: Once
2. Set as `STRIPE_COUPON_FRIEND20` in Vercel env vars

### ANNUAL10 — 10% Off Annual Plan

1. Create another coupon:
   - **Name**: Annual 10% Off
   - **Percentage off**: 10%
   - **Duration**: Once
   - **Applies to**: Only the annual price (restrict in checkout logic)
2. Set as `STRIPE_COUPON_ANNUAL10` in Vercel env vars

---

## 3. Environment Variables

Add these to **Vercel** > **Settings** > **Environment Variables**:

```bash
STRIPE_COUPON_LAUNCH50=coupon_id_from_stripe
STRIPE_COUPON_FRIEND20=coupon_id_from_stripe
STRIPE_COUPON_ANNUAL10=coupon_id_from_stripe
```

---

## 4. API Endpoint

### POST `/api/apply-coupon`

Validates a coupon code and returns the Stripe coupon ID to use in checkout.

**Request:**
```json
{
  "code": "LAUNCH50"
}
```

**Success Response:**
```json
{
  "success": true,
  "code": "LAUNCH50",
  "discount": "50% off first month",
  "stripe_coupon": "coupon_id_here"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid or expired coupon code.",
  "code": "INVALID_COUPON"
}
```

---

## 5. Applying Coupons at Checkout

To apply a validated coupon to a Stripe Checkout session, pass the `discounts` parameter:

```javascript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer_email: email,
  line_items: [{ price: priceId, quantity: 1 }],
  discounts: couponId ? [{ coupon: couponId }] : [],
  success_url: '...',
  cancel_url: '...'
});
```

---

## 6. Frontend Integration

On the pricing/checkout page, add a coupon input field:

```javascript
async function applyCoupon(code) {
  const res = await fetch('/api/apply-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const data = await res.json();
  if (data.success) {
    // Store coupon for checkout
    window._couponId = data.stripe_coupon;
    // Show success message with discount details
  }
}
```

Then pass `window._couponId` when calling the checkout API.

---

## 7. Testing

1. Create test coupons in **Stripe Test mode**
2. Set test coupon IDs in Vercel **Preview** environment
3. Verify:
   - [ ] Valid code returns success with discount details
   - [ ] Invalid code returns 404 error
   - [ ] Expired coupon returns 410 error
   - [ ] Coupon is applied correctly in Stripe Checkout
   - [ ] Discount appears on the Stripe receipt
