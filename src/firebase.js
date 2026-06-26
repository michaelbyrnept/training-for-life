import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCQ3OHZ5evhNTFtnrtNou8SUjsINaKBNl8",
  authDomain: "trainingforlife-1422f.firebaseapp.com",
  projectId: "trainingforlife-1422f",
  storageBucket: "trainingforlife-1422f.firebasestorage.app",
  messagingSenderId: "108466435540",
  appId: "1:108466435540:web:bb10e4e91dcf70bb7b1241",
};

const app = initializeApp(firebaseConfig);

// Offline persistence — workouts and exercise library available without signal.
// persistentMultipleTabManager handles multiple browser tabs gracefully.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
export default app;
