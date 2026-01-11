"use client";

import { auth } from "@/lib/firebaseClient";
import { GithubAuthProvider, signInWithPopup } from "firebase/auth";

export default function LoginPage() {
  async function signInGithub() {
    const provider = new GithubAuthProvider();
    provider.addScope("read:user"); // optional
    provider.addScope("user:email"); // optional

    await signInWithPopup(auth, provider);

    // At this point, Firebase holds the user session in the browser
    window.location.href = "/";
  }

  return (
    <main style={{ padding: 24 }}>
      <button onClick={signInGithub}>Continue with GitHub</button>
    </main>
  );
}
