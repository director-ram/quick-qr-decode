
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDmv9blz5rP55kp8_a9gnGdn1UQcI1753k",
  authDomain: "qr-users-8e1c4.firebaseapp.com",
  projectId: "qr-users-8e1c4",
  storageBucket: "qr-users-8e1c4.appspot.com",
  messagingSenderId: "802989435149",
  appId: "1:802989435149:web:a14939bb8fe04599a3e844",
  measurementId: "G-YQLS5FXCX1"
  // Note: databaseURL was omitted — not used for Firestore in this app!
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

