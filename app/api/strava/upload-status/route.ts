import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/getServerUser";
import { refreshStravaTokenIfNeeded } from "@/lib/strava";

export async function GET(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(req.url);
  const uploadId = url.searchParams.get("uploadId");
  if (!uploadId) return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });

  const tokens = await refreshStravaTokenIfNeeded(user.uid);
  if (!tokens) return NextResponse.json({ error: "Strava not connected" }, { status: 400 });

  const res = await fetch(`https://www.strava.com/api/v3/uploads/${uploadId}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: "Status check failed", detail: json }, { status: 500 });

  return NextResponse.json(json);
}
