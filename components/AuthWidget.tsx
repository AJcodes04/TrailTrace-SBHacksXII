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
  async function login() {
    const provider = new GithubAuthProvider();
    provider.addScope("read:user");
    provider.addScope("user:email");

    await signInWithPopup(auth, provider);
  }

  return (
    <button onClick={login}>
      Sign in with GitHub
    </button>
  );
}

function UserBadge({ user }: { user: User }) {
  const photoURL = user.photoURL; // GitHub avatar usually
  const name = user.displayName ?? user.email ?? "Signed in";

  async function logout() {
    await signOut(auth);
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
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
      <button onClick={logout}>Sign out</button>
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

  if (loading) return null; // or a skeleton/spinner

  return user ? <UserBadge user={user} /> : <LoginButton />;
}
