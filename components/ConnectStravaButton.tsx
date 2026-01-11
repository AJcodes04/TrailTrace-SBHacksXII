"use client";

import { useState } from "react";
import { auth } from "@/lib/firebaseClient";

export function ConnectStravaButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  async function connect() {
    setErr("");
    setBusy(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Please sign in first");
      }

      // Ensure session cookie is set before redirecting
      const idToken = await user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to set session cookie: ${text}`);
      }

      // Now redirect to the authorize endpoint
      window.location.href = "/api/strava/authorize";
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to connect");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={connect} disabled={busy}>
        {busy ? "Connecting..." : "Connect Strava"}
      </button>
      {err ? <span style={{ color: "crimson" }}>{err}</span> : null}
    </div>
  );
}
