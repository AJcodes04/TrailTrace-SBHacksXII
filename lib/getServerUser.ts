import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function getServerUser() {
  const session = cookies().get("__session")?.value;
  if (!session) return null;

  try {
    return await adminAuth.verifySessionCookie(session, true);
  } catch {
    return null;
  }
}