
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";

// Firebase project configuration - uses environment variables in production
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDmv9blz5rP55kp8_a9gnGdn1UQcI1753k",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "qr-users-8e1c4.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://qr-users-8e1c4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "qr-users-8e1c4",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "qr-users-8e1c4.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "802989435149",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:802989435149:web:a14939bb8fe04599a3e844",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-YQLS5FXCX1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Configure Google Auth Provider with minimal scope
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  hd: '' // Allow any domain
});

// Log initialization for debugging
console.log('Firebase initialized successfully');
console.log('Project ID:', firebaseConfig.projectId);
console.log('Auth Domain:', firebaseConfig.authDomain);
console.log('⚠️  Using demo Firebase config - create your own for production!');

