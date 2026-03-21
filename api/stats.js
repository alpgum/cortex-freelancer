const { getFirestore } = require('./_lib/firestore');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getFirestore();

    // Get waitlist count
    const waitlistSnap = await db.collection('waitlist').count().get();
    const waitlistCount = waitlistSnap.data().count || 0;

    // Get user count
    const usersSnap = await db.collection('users').count().get();
    const userCount = usersSnap.data().count || 0;

    // Get total proposals generated (from usage collection)
    const proposalsSnap = await db.collection('usage')
      .where('tool', '==', 'proposal')
      .count()
      .get();
    const proposalCount = proposalsSnap.data().count || 0;

    const SEED_WAITLIST = 847;
    const SEED_PROPOSALS = 2400;
    const SEED_COUNTRIES = 150;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      waitlist: SEED_WAITLIST + waitlistCount,
      users: userCount,
      proposals: SEED_PROPOSALS + proposalCount,
      countries: SEED_COUNTRIES,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Stats API error:', err);
    return res.status(200).json({
      waitlist: 847,
      users: 0,
      proposals: 2400,
      countries: 150,
      updatedAt: new Date().toISOString()
    });
  }
};
