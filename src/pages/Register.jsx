import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import { auth, db } from "../firebase";

export default function Register() {
 const [firstName, setFirstName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await setDoc(
  doc(db, "users", userCredential.user.uid),
  {
    firstName,
    email,
    subscription: "free",
  }
);

      console.log("User created:", userCredential.user);
console.log("First Name:", firstName);
      alert("Account created!");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <div className="p-8">
      <h1>Create Account</h1>

      <form
        onSubmit={handleRegister}
        className="flex flex-col gap-4 max-w-sm"
      >
        <input
  type="text"
  placeholder="First Name"
  value={firstName}
  onChange={(e) =>
    setFirstName(e.target.value)
  }
  className="border p-2"
/>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          className="border p-2"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="border p-2"
        />

        <button
          type="submit"
          className="bg-emerald-700 text-white p-2 rounded"
        >
          Create Account
        </button>
      </form>
    </div>
  );
}