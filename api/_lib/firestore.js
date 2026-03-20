// Shared Firebase Admin / Firestore lazy initializer
let db = null;

function getFirestore() {
  if (db) return db;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : null;
      if (serviceAccount) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else {
        admin.initializeApp();
      }
    }
    db = admin.firestore();
    return db;
  } catch (err) {
    console.warn('Firebase Admin not available, skipping Firestore writes:', err.message);
    return null;
  }
}

module.exports = { getFirestore };
