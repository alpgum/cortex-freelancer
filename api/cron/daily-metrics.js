/* ===== [255] Daily Metrics Cron — Email yesterday's stats ===== */
const { getFirestore } = require('../lib/firestore');
const { sendError, withErrorHandler } = require('../middleware/error-handler');

async function handler(req, res) {
  // Vercel Cron auth
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED', 'auth_error');
  }

  const firestore = getFirestore();
  if (!firestore) {
    return res.status(200).json({ success: true, message: 'Firestore not available — mock mode.', metrics: null });
  }

  try {
    // Calculate yesterday's date range
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
    const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1).toISOString();

    // Gather metrics
    const usersSnap = await firestore.collection('users').get();
    const totalUsers = usersSnap.size;

    // New signups yesterday
    const newUsersSnap = await firestore.collection('users')
      .where('createdAt', '>=', startOfDay)
      .where('createdAt', '<', endOfDay)
      .get();
    const newSignups = newUsersSnap.size;

    // Pro users count
    let proUsers = 0;
    usersSnap.forEach(doc => {
      if (doc.data().isPro) proUsers++;
    });

    // MRR estimate
    const mrr = proUsers * 29;

    // [324] Revenue metrics — new subscribers, churned, and total revenue
    let newSubscribers = 0;
    let churned = 0;
    let totalRevenue = 0;

    try {
      // New checkouts yesterday
      const checkoutsSnap = await firestore.collection('processed_events')
        .where('processedAt', '>=', startOfDay)
        .where('processedAt', '<', endOfDay)
        .get();
      checkoutsSnap.forEach(doc => {
        const d = doc.data();
        if (d.eventType === 'checkout.session.completed') newSubscribers++;
        if (d.eventType === 'customer.subscription.deleted') churned++;
      });
    } catch (e) { /* collection may not exist yet */ }

    // Annual plans contribute $21/mo effective, monthly $29
    let annualPros = 0;
    usersSnap.forEach(doc => {
      const d = doc.data();
      if (d.isPro && d.plan === 'pro_annual') annualPros++;
    });
    const monthlyPros = proUsers - annualPros;
    totalRevenue = (monthlyPros * 29) + (annualPros * 21);
    const arpu = proUsers > 0 ? Math.round(totalRevenue / proUsers) : 0;
    const churnRate = proUsers > 0 ? ((churned / (proUsers + churned)) * 100).toFixed(1) + '%' : '0%';

    // Client errors yesterday
    let errorCount = 0;
    try {
      const errSnap = await firestore.collection('client_errors')
        .where('timestamp', '>=', startOfDay)
        .where('timestamp', '<', endOfDay)
        .get();
      errorCount = errSnap.size;
    } catch (e) { /* collection may not exist yet */ }

    const metrics = {
      date: yesterday.toISOString().split('T')[0],
      totalUsers,
      newSignups,
      proUsers,
      mrr,
      totalRevenue,
      newSubscribers,
      churned,
      arpu,
      churnRate,
      errorCount,
      conversionRate: totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(1) + '%' : '0%'
    };

    // Send email via Resend / SMTP if configured
    const adminEmail = process.env.ADMIN_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;

    if (adminEmail && resendKey) {
      const emailBody = `
Daily Metrics Report — ${metrics.date}
========================================
Total Users:      ${metrics.totalUsers}
New Signups:      ${metrics.newSignups}
Pro Users:        ${metrics.proUsers}
MRR:              $${metrics.mrr}
Total Revenue:    $${metrics.totalRevenue}
New Subscribers:  ${metrics.newSubscribers}
Churned:          ${metrics.churned}
ARPU:             $${metrics.arpu}
Churn Rate:       ${metrics.churnRate}
Conversion Rate:  ${metrics.conversionRate}
Client Errors:    ${metrics.errorCount}
========================================
`;

      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Cortex Metrics <metrics@cortexfreelancer.com>',
            to: adminEmail,
            subject: `[Cortex] Daily Metrics — ${metrics.date} | ${metrics.newSignups} signups, $${metrics.mrr} MRR, ${metrics.newSubscribers} new subs`,
            text: emailBody
          })
        });
        const emailData = await emailRes.json();
        console.log('[daily-metrics] Email sent:', emailData.id || 'ok');
      } catch (emailErr) {
        console.error('[daily-metrics] Email send failed:', emailErr.message);
      }
    } else {
      console.log('[daily-metrics] No ADMIN_EMAIL or RESEND_API_KEY set, skipping email.');
    }

    // Store metrics in Firestore for historical reference
    await firestore.collection('daily_metrics').doc(metrics.date).set(metrics);

    console.log('[daily-metrics]', JSON.stringify(metrics));
    return res.status(200).json({ success: true, metrics });

  } catch (err) {
    console.error('[daily-metrics] Error:', err.message);
    return sendError(res, 500, 'Failed to gather metrics.', 'METRICS_ERROR', 'server_error');
  }
}

module.exports = withErrorHandler(handler);
