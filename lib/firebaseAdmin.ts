// lib/firebaseAdmin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function normalizePrivateKey(key?: string) {
  if (!key) return undefined;
  // Replace escaped newlines, and strip surrounding quotes if present
  return key.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if (!projectId || !clientEmail || !privateKey) {
  // Don't crash the whole app build; throw only when this file is used
  throw new Error(
    `Missing Firebase Admin env vars. Need FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY`
  );
}

const app =
  getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
