import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/getServerUser";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const origin = new URL(req.url).origin;

  // Add a state param so we can validate callback belongs to this user
  // (Simple approach: uid in state. Better: random nonce stored in DB.)
  const state = user.uid;

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.STRAVA_REDIRECT_URI ?? `${origin}/api/strava/callback`,
    approval_prompt: "force",
    scope: "activity:write",
    state,
  });

  return NextResponse.redirect(`https://www.strava.com/oauth/authorize?${params.toString()}`);
}
