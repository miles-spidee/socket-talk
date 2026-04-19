import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB4SOiyKIEGJuhDmTWO2ody_5WHh_iGHbk",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "socket-dc443.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "socket-dc443",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "socket-dc443.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "232809241936",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:232809241936:web:ea2009d038826832d6a055",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
