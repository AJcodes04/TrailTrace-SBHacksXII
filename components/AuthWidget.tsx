// components/AuthWidget.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { auth } from "@/lib/firebaseClient";
import {
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

function LoginButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  async function login() {
    setErr("");
    setBusy(true);

    try {
      const provider = new GithubAuthProvider();
      provider.addScope("read:user");
      provider.addScope("user:email");

      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // make cookie behavior explicit
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to set session cookie: ${text}`);
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={login} disabled={busy}>
        {busy ? "Signing in..." : "Sign in with GitHub"}
      </button>
      {err ? <span style={{ color: "crimson" }}>{err}</span> : null}
    </div>
  );
}

function UserBadge({ user }: { user: User }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const name = user.displayName ?? user.email ?? "Signed in";
  const photoURL = user.photoURL;

  async function logout() {
    setErr("");
    setBusy(true);

    try {
      // clear client auth
      await signOut(auth);

      // clear server session
      const res = await fetch("/api/auth/session", {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to clear session cookie: ${text}`);
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Sign out failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {photoURL ? (
        <Image
          src={photoURL}
          alt={name}
          width={32}
          height={32}
          style={{ borderRadius: 9999 }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            background: "#ddd",
          }}
        />
      )}

      <span>{name}</span>

      <button onClick={logout} disabled={busy}>
        {busy ? "Signing out..." : "Sign out"}
      </button>

      {err ? <span style={{ color: "crimson" }}>{err}</span> : null}
    </div>
  );
}

export default function AuthWidget() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // You can swap this for a spinner/skeleton
  if (loading) return null;

  return user ? <UserBadge user={user} /> : <LoginButton />;
}
