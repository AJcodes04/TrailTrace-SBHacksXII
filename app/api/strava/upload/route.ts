import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/getServerUser";
import { refreshStravaTokenIfNeeded } from "@/lib/strava";

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const name = form.get("name")?.toString() ?? "Trail Trace Upload";
  const description = form.get("description")?.toString() ?? "";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const tokens = await refreshStravaTokenIfNeeded(user.uid);
  if (!tokens) return NextResponse.json({ error: "Strava not connected" }, { status: 400 });

  const stravaForm = new FormData();
  stravaForm.set("file", file);
  stravaForm.set("data_type", "gpx");
  stravaForm.set("name", name);
  if (description) stravaForm.set("description", description);

  const upRes = await fetch("https://www.strava.com/api/v3/uploads", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
    body: stravaForm,
  });

  const upJson = await upRes.json();
  if (!upRes.ok) {
    return NextResponse.json({ error: "Upload failed", detail: upJson }, { status: 500 });
  }

  // returns upload_id, status, activity_id (later), error, etc.
  return NextResponse.json(upJson);
}
