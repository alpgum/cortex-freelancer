/* ===== TOOL STATS API ===== */
/* [244] Tool popularity endpoint */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const statsDoc = await db.collection('analytics').doc('tool_stats').get();

    if (statsDoc.exists) {
      return res.status(200).json(statsDoc.data());
    }

    // Fallback: aggregate from usage logs
    const usageSnap = await db.collection('tool_usage')
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();

    const stats = {};
    usageSnap.forEach(function(doc) {
      var data = doc.data();
      var tool = data.tool_name || 'unknown';
      if (!stats[tool]) {
        stats[tool] = { uses: 0, unique_users: new Set() };
      }
      stats[tool].uses++;
      if (data.user_id) stats[tool].unique_users.add(data.user_id);
    });

    // Convert Sets to counts
    var result = {
      tools: [],
      total_uses: 0,
      generated_at: new Date().toISOString()
    };

    for (var tool in stats) {
      var entry = {
        name: tool,
        uses: stats[tool].uses,
        unique_users: stats[tool].unique_users.size
      };
      result.tools.push(entry);
      result.total_uses += entry.uses;
    }

    result.tools.sort(function(a, b) { return b.uses - a.uses; });

    return res.status(200).json(result);
  } catch (err) {
    console.error('tool-stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch tool stats' });
  }
};
