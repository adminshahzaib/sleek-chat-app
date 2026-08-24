import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let firebaseApp;

const initializeFirebaseAdmin = () => {
  if (firebaseApp) return firebaseApp;

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[Firebase] Admin SDK initialized successfully from environment variable JSON.');
    } else {
      // Look for a local file (e.g. serviceAccountKey.json)
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });
      console.log(`[Firebase] Admin SDK initialized from local file path: ${serviceAccountPath}`);
    }
  } catch (error) {
    console.error(`[Firebase] Initialization Error: ${error.message}`);
    console.error('[Firebase] WARNING: Backend was unable to initialize Firebase Admin SDK. Calls requiring authentication will fail.');
  }

  return firebaseApp;
};

initializeFirebaseAdmin();

export default admin;
