import { NextResponse } from "next/server";
import { saveStravaTokens } from "@/lib/strava";

export const runtime = "nodejs"

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state"); // we used uid

  if (error) {
    return NextResponse.redirect(new URL(`/settings?strava=denied`, url.origin));
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code/state" }, { status: 400 });
  }

  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: "Token exchange failed", detail: text }, { status: 500 });
  }

  const json = await tokenRes.json();

  await saveStravaTokens(state, {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at,
    athleteId: json.athlete?.id,
    scope: json.scope,
  });

  return NextResponse.redirect(new URL(`/settings?strava=connected`, url.origin));
}
