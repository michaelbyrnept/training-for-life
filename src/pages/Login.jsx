import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
    const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      console.log("Logged in:", userCredential.user);

      navigate("/dashboard");
    } catch (error) {
  console.error(error);

  if (error.code === "auth/invalid-credential") {
    alert("Incorrect email or password");
  } else {
    alert("Something went wrong. Please try again.");
  }
}
  };

  return (
    <div className="p-8">
      <h1>Login</h1>

      <form
        onSubmit={handleLogin}
        className="flex flex-col gap-4 max-w-sm"
      >
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
          Login
        </button>
      </form>
    </div>
  );
}