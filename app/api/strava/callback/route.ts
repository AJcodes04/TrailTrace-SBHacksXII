// import { NextResponse } from "next/server";
// import { saveStravaTokens } from "@/lib/strava";

// export const runtime = "nodejs"

// export async function GET(req: Request) {
//   const url = new URL(req.url);
//   const code = url.searchParams.get("code");
//   const error = url.searchParams.get("error");
//   const state = url.searchParams.get("state"); // we used uid

//   if (error) {
//     return NextResponse.redirect(new URL(`/settings?strava=denied`, url.origin));
//   }
//   if (!code || !state) {
//     return NextResponse.json({ error: "Missing code/state" }, { status: 400 });
//   }

//   const tokenRes = await fetch("https://www.strava.com/oauth/token", {
//     method: "POST",
//     headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     body: new URLSearchParams({
//       client_id: process.env.STRAVA_CLIENT_ID!,
//       client_secret: process.env.STRAVA_CLIENT_SECRET!,
//       code,
//       grant_type: "authorization_code",
//     }),
//   });

//   if (!tokenRes.ok) {
//     const text = await tokenRes.text();
//     return NextResponse.json({ error: "Token exchange failed", detail: text }, { status: 500 });
//   }

//   const json = await tokenRes.json();

//   await saveStravaTokens(state, {
//     accessToken: json.access_token,
//     refreshToken: json.refresh_token,
//     expiresAt: json.expires_at,
//     athleteId: json.athlete?.id,
//     scope: json.scope,
//   });

//   return NextResponse.redirect(new URL(`/settings?strava=connected`, url.origin));
// }

export const runtime = "nodejs";

import { NextResponse } from "next/server";
// import { saveStravaTokens } from "@/lib/strava"; // add back after token exchange works

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL(`/settings?strava=denied`, url.origin));
    }
    if (!code || !state) {
      return NextResponse.json({ error: "Missing code/state", code, state }, { status: 400 });
    }

    // Check env vars early (most common 500 cause)
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      return NextResponse.json(
        { error: "Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET" },
        { status: 500 }
      );
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

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      // This will show the real Strava error (redirect_uri mismatch, invalid code, etc.)
      return NextResponse.json(
        { error: "Token exchange failed", detail: tokenJson },
        { status: 500 }
      );
    }

    // TEMP: prove token exchange works first
    // Once confirmed, store tokens to Firestore:
    // await saveStravaTokens(state, {
    //   accessToken: tokenJson.access_token,
    //   refreshToken: tokenJson.refresh_token,
    //   expiresAt: tokenJson.expires_at,
    //   athleteId: tokenJson.athlete?.id,
    //   scope: tokenJson.scope,
    // });

    return NextResponse.redirect(new URL(`/settings?strava=connected`, url.origin));
  } catch (e: any) {
    return NextResponse.json(
      { error: "Callback crashed", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

