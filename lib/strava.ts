import { db } from "@/lib/firebaseAdmin";

export type StravaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
  athleteId: number;
  scope?: string;
};

const docRef = (uid: string) =>
  db.collection("users").doc(uid).collection("integrations").doc("strava");

export async function saveStravaTokens(uid: string, tokens: StravaTokens) {
  await docRef(uid).set(tokens, { merge: true });
}

export async function getStravaTokens(uid: string): Promise<StravaTokens | null> {
  const snap = await docRef(uid).get();
  return snap.exists ? (snap.data() as StravaTokens) : null;
}

export function isExpired(expiresAt: number) {
  const now = Math.floor(Date.now() / 1000);
  // refresh 60s early to avoid edge timing issues
  return now >= (expiresAt - 60);
}

export async function refreshStravaTokenIfNeeded(uid: string) {
  const current = await getStravaTokens(uid);
  if (!current) return null;

  if (!isExpired(current.expiresAt)) return current;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava refresh failed: ${text}`);
  }

  const json = await res.json();

  const updated: StravaTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at,
    athleteId: current.athleteId,
    scope: json.scope,
  };

  await saveStravaTokens(uid, updated);
  return updated;
}
