"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import {
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

interface LoginButtonProps {
  className?: string;
  redirectTo?: string;
}

function LoginButton({ className = "", redirectTo }: LoginButtonProps) {
  const router = useRouter();

  async function login() {
    try {
      const provider = new GithubAuthProvider();
      provider.addScope("read:user");
      provider.addScope("user:email");

      await signInWithPopup(auth, provider);
      if (redirectTo) {
        router.push(redirectTo);
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  }

  return (
    <button
      onClick={login}
      className={`w-full px-4 py-2 rounded-lg bg-forest-700 dark:bg-forest-600 hover:bg-forest-800 dark:hover:bg-forest-500 text-white transition-colors text-sm font-semibold ${className}`}
    >
      Sign in with GitHub
    </button>
  );
}

interface UserBadgeProps {
  user: User;
  className?: string;
  showSignOut?: boolean;
  onSignOut?: () => void;
}

function UserBadge({ user, className = "", showSignOut = true, onSignOut }: UserBadgeProps) {
  const router = useRouter();
  const photoURL = user.photoURL;
  const name = user.displayName ?? user.email ?? "Signed in";
  const displayName = name.length > 20 ? name.substring(0, 20) + "..." : name;

  async function logout() {
    try {
      await signOut(auth);
      if (onSignOut) {
        onSignOut();
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-3 px-2">
        {photoURL ? (
          <Image
            src={photoURL}
            alt={name}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-forest-300 dark:bg-forest-600" />
        )}
        <span className="text-sm text-forest-700 dark:text-forest-200 font-medium truncate flex-1">
          {displayName}
        </span>
      </div>
      {showSignOut && (
        <button
          onClick={logout}
          className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-semibold"
        >
          Sign Out
        </button>
      )}
    </div>
  );
}

function CompactUserBadge({ user, onSignOut, className }: { user: User; onSignOut?: () => void; className?: string }) {
  const router = useRouter();

  async function logout() {
    try {
      await signOut(auth);
      if (onSignOut) {
        onSignOut();
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      {user.photoURL ? (
        <Image
          src={user.photoURL}
          alt={user.displayName || "User"}
          width={32}
          height={32}
          className="rounded-full"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-forest-300 dark:bg-forest-600" />
      )}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-forest-700 dark:text-forest-200 leading-tight">
          {user.displayName || user.email?.split('@')[0] || "User"}
        </span>
        <button
          onClick={logout}
          className="text-xs text-red-500 hover:text-red-600 transition-colors text-left"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

interface AuthWidgetProps {
  className?: string;
  redirectTo?: string;
  showSignOut?: boolean;
  onSignOut?: () => void;
  variant?: "compact" | "full";
}

export default function AuthWidget({
  className = "",
  redirectTo,
  showSignOut = true,
  onSignOut,
  variant = "full",
}: AuthWidgetProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="w-full h-10 bg-forest-100 dark:bg-forest-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (variant === "compact") {
    return user ? (
      <CompactUserBadge user={user} onSignOut={onSignOut} className={className} />
    ) : (
      <LoginButton className={className} redirectTo={redirectTo} />
    );
  }

  return user ? (
    <UserBadge user={user} className={className} showSignOut={showSignOut} onSignOut={onSignOut} />
  ) : (
    <LoginButton className={className} redirectTo={redirectTo} />
  );
}
