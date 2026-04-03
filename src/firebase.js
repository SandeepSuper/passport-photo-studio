import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDcMuUNA07R7I1QVbcjFzfJ6eNUcLktsNI",
  authDomain: "photopassport.in",
  projectId: "photo-app-30f33",
  storageBucket: "photo-app-30f33.firebasestorage.app",
  messagingSenderId: "701768114705",
  appId: "1:701768114705:web:e2b615943d784d683a87b0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
