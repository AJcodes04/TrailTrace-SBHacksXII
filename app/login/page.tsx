"use client";

import { auth } from "@/lib/firebaseClient";
import { GithubAuthProvider, signInWithPopup } from "firebase/auth";
import Header from "@/components/Header";

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
    <div className="min-h-screen bg-stone-50 dark:bg-forest-900">
      <Header />
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="max-w-md w-full bg-white dark:bg-forest-800 rounded-xl shadow-lg p-8 border border-forest-200 dark:border-forest-700">
          <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-6 text-center">
            Sign in to TrailTrace
          </h1>
          <button
            onClick={signInGithub}
            className="w-full px-4 py-3 rounded-lg bg-forest-700 dark:bg-forest-600 hover:bg-forest-800 dark:hover:bg-forest-500 text-white transition-colors text-sm font-semibold"
          >
            Continue with GitHub
          </button>
        </div>
      </main>
    </div>
  );
}
