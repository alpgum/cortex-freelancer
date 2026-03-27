// User database service — Firestore CRUD operations for user data
const { getFirestore } = require('../lib/firestore');

/**
 * Get user document by UID.
 * Returns user data or null if not found / Firestore unavailable.
 */
async function getUser(uid) {
  const db = getFirestore();
  if (!db) return null;

  try {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { uid: doc.id, ...doc.data() } : null;
  } catch (err) {
    console.error('[user-service] getUser failed:', err.message);
    return null;
  }
}

/**
 * Get user by email address.
 */
async function getUserByEmail(email) {
  const db = getFirestore();
  if (!db) return null;

  try {
    const snapshot = await db.collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { uid: doc.id, ...doc.data() };
  } catch (err) {
    console.error('[user-service] getUserByEmail failed:', err.message);
    return null;
  }
}

/**
 * Create or update user document (merge).
 */
async function upsertUser(uid, data) {
  const db = getFirestore();
  if (!db) return false;

  try {
    await db.collection('users').doc(uid).set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[user-service] upsertUser failed:', err.message);
    return false;
  }
}

/**
 * Get user profile (extended data).
 */
async function getProfile(uid) {
  const db = getFirestore();
  if (!db) return null;

  try {
    const doc = await db.collection('profiles').doc(uid).get();
    return doc.exists ? { uid: doc.id, ...doc.data() } : null;
  } catch (err) {
    console.error('[user-service] getProfile failed:', err.message);
    return null;
  }
}

/**
 * Save user profile.
 */
async function saveProfile(uid, data) {
  const db = getFirestore();
  if (!db) return false;

  try {
    await db.collection('profiles').doc(uid).set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[user-service] saveProfile failed:', err.message);
    return false;
  }
}

/**
 * Get user preferences.
 */
async function getPreferences(uid) {
  const db = getFirestore();
  if (!db) return null;

  try {
    const doc = await db.collection('user_preferences').doc(uid).get();
    return doc.exists ? doc.data() : {};
  } catch (err) {
    console.error('[user-service] getPreferences failed:', err.message);
    return {};
  }
}

/**
 * Save user preferences.
 */
async function savePreferences(uid, prefs) {
  const db = getFirestore();
  if (!db) return false;

  try {
    await db.collection('user_preferences').doc(uid).set({
      ...prefs,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[user-service] savePreferences failed:', err.message);
    return false;
  }
}

/**
 * Check if user has active pro subscription.
 */
async function isProUser(identifier) {
  const db = getFirestore();
  if (!db) return false;

  try {
    let user;
    // If it looks like a UID (no @), query by doc ID
    if (identifier && !identifier.includes('@')) {
      user = await getUser(identifier);
    } else if (identifier) {
      user = await getUserByEmail(identifier);
    }
    if (!user) return false;

    // Check isPro flag and expiration
    if (!user.isPro) return false;
    if (user.proExpiresAt) {
      return new Date(user.proExpiresAt) > new Date();
    }
    return true;
  } catch (err) {
    console.error('[user-service] isProUser check failed:', err.message);
    return false;
  }
}

/**
 * Delete all user data across collections (GDPR).
 * Returns summary of deletions.
 */
async function deleteUserData(uid, email) {
  const db = getFirestore();
  if (!db) return { success: false, error: 'Database unavailable' };

  const results = {};
  const collections = ['users', 'profiles', 'user_preferences', 'bookmarks', 'proposals', 'analytics'];

  try {
    // Delete user documents keyed by UID
    for (const col of collections) {
      try {
        const doc = await db.collection(col).doc(uid).get();
        if (doc.exists) {
          await db.collection(col).doc(uid).delete();
          results[col] = 1;
        } else {
          results[col] = 0;
        }
      } catch (err) {
        console.error(`[user-service] delete ${col}/${uid} failed:`, err.message);
        results[col] = 0;
      }
    }

    // Delete sessions subcollection
    try {
      const sessions = await db.collection('users').doc(uid).collection('sessions').get();
      const batch = db.batch();
      sessions.docs.forEach(doc => batch.delete(doc.ref));
      if (!sessions.empty) await batch.commit();
      results.sessions = sessions.size;
    } catch (err) {
      results.sessions = 0;
    }

    // Delete events by UID
    try {
      const events = await db.collection('events').where('uid', '==', uid).get();
      if (!events.empty) {
        const batch = db.batch();
        events.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      results.events = events.size;
    } catch (err) {
      results.events = 0;
    }

    // Delete feedback by UID or email
    try {
      let feedbackCount = 0;
      const byUid = await db.collection('feedback').where('uid', '==', uid).get();
      if (!byUid.empty) {
        const batch = db.batch();
        byUid.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        feedbackCount += byUid.size;
      }
      if (email) {
        const byEmail = await db.collection('feedback').where('email', '==', email).get();
        if (!byEmail.empty) {
          const batch = db.batch();
          byEmail.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          feedbackCount += byEmail.size;
        }
      }
      results.feedback = feedbackCount;
    } catch (err) {
      results.feedback = 0;
    }

    // Delete notifications subcollection
    try {
      const notifs = await db.collection('notifications').doc(uid).collection('items').get();
      if (!notifs.empty) {
        const batch = db.batch();
        notifs.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      results.notifications = notifs.size;
    } catch (err) {
      results.notifications = 0;
    }

    // Delete waitlist entries by email
    if (email) {
      try {
        const wl = await db.collection('waitlist').where('email', '==', email.toLowerCase()).get();
        if (!wl.empty) {
          const batch = db.batch();
          wl.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
        results.waitlist = wl.size;
      } catch (err) {
        results.waitlist = 0;
      }
    }

    const totalRemoved = Object.values(results).reduce((sum, n) => sum + n, 0);
    return { success: true, results, totalRemoved };
  } catch (err) {
    console.error('[user-service] deleteUserData failed:', err.message);
    return { success: false, error: err.message, results };
  }
}

/**
 * Record tool usage for a user.
 */
async function trackToolUsage(uid, tool) {
  const db = getFirestore();
  if (!db) return false;

  try {
    const admin = require('firebase-admin');
    await db.collection('users').doc(uid).set({
      [`toolUsage.${tool}`]: admin.firestore.FieldValue.increment(1),
      lastToolUsed: tool,
      lastActiveAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[user-service] trackToolUsage failed:', err.message);
    return false;
  }
}

module.exports = {
  getUser,
  getUserByEmail,
  upsertUser,
  getProfile,
  saveProfile,
  getPreferences,
  savePreferences,
  isProUser,
  deleteUserData,
  trackToolUsage
};
