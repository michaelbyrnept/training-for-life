import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export function useUnreadMessageCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let msgUnsub = () => {};
    const authUnsub = onAuthStateChanged(auth, (u) => {
      msgUnsub();
      if (!u) { setCount(0); return; }
      const q = query(
        collection(db, "messages"),
        where("toUid", "==", u.uid),
        where("readByRecipient", "==", false)
      );
      msgUnsub = onSnapshot(q, (snap) => setCount(snap.size), () => {});
    });
    return () => { authUnsub(); msgUnsub(); };
  }, []);

  return count;
}
