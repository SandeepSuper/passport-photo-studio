import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDcMuUNA07R7I1QVbcjFzfJ6eNUcLktsNI",
  authDomain: "photo-app-30f33.firebaseapp.com",
  projectId: "photo-app-30f33",
  storageBucket: "photo-app-30f33.firebasestorage.app",
  messagingSenderId: "701768114705",
  appId: "1:701768114705:web:e2b615943d784d683a87b0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const email = "sandeep.official.saini@gmail.com";
const expiry = new Date().getTime() + (365 * 24 * 60 * 60 * 1000); // 1 year

async function makePro() {
  try {
    const userRef = doc(db, "users", email);
    await setDoc(userRef, {
      email,
      role: 'pro',
      expiry,
      freeDownloads: 0
    }, { merge: true });
    console.log(`SUCCESS: ${email} is now a PRO user.`);
  } catch (e) {
    console.error(`FAILED: Could not update user. This is probably due to Firestore security rules.`, e);
    console.log("\nTIP: You can manually set the role to 'pro' in the Firebase Console for this user.");
  }
  process.exit();
}

makePro();
