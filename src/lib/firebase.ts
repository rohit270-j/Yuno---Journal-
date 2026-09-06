import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAfBFq38ACS7s_CnsXDd6-YTu83H1ZmPok",
  authDomain: "gen-lang-client-0063974169.firebaseapp.com",
  projectId: "gen-lang-client-0063974169",
  storageBucket: "gen-lang-client-0063974169.firebasestorage.app",
  messagingSenderId: "192097957711",
  appId: "1:192097957711:web:380a15b7d2e8aed4bbb73a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-539f1622-6027-45aa-83ea-6073132e334a");
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
