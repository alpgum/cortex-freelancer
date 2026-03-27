/**
 * Firebase Configuration for Cortex Freelancer
 * Authentication and Firestore database setup
 */

// Firebase configuration object
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Development emulators (only in development)
if (process.env.NODE_ENV === 'development' && process.env.USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('🔧 Firebase emulators connected');
  } catch (error) {
    console.warn('Firebase emulator connection failed:', error.message);
  }
}

// Database collections
export const COLLECTIONS = {
  USERS: 'users',
  USER_PROFILES: 'user_profiles',
  USER_PATTERNS: 'user_patterns', 
  USER_CONTEXT: 'user_context',
  JOBS: 'jobs',
  JOB_APPLICATIONS: 'job_applications',
  PROPOSALS: 'proposals',
  CLIENTS: 'clients',
  PROJECTS: 'projects',
  INVOICES: 'invoices',
  ANALYTICS: 'analytics'
};

// Firestore indexes needed
export const REQUIRED_INDEXES = [
  {
    collection: 'user_patterns',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'timestamp', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'jobs', 
    fields: [
      { field: 'platform', order: 'ASCENDING' },
      { field: 'posted', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'job_applications',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'status', order: 'ASCENDING' },
      { field: 'appliedAt', order: 'DESCENDING' }
    ]
  }
];

// Security rules template
export const SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /user_profiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /user_patterns/{userId}/actions/{actionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /user_context/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Jobs are readable by authenticated users
    match /jobs/{jobId} {
      allow read: if request.auth != null;
      allow write: if false; // Only server can write jobs
    }
    
    // Applications belong to users
    match /job_applications/{applicationId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Proposals belong to users  
    match /proposals/{proposalId} {
      allow read, write: if request.auth != null &&
        request.auth.uid == resource.data.userId;
    }
  }
}
`;

export default app;