import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

export default function AdminRoute({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  if (user === undefined) return null;

  if (!user || user.uid !== ADMIN_UID) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
