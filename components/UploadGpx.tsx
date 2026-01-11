"use client";

import { useState } from "react";

export function UploadGpx() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [activityId, setActivityId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  async function upload() {
    setError("");
    setStatus("");
    setActivityId(null);
    setUploadId(null);

    if (!file) return;

    const form = new FormData();
    form.set("file", file);
    form.set("name", file.name.replace(/\.gpx$/i, ""));

    const res = await fetch("/api/strava/upload", { method: "POST", body: form });
    const json = await res.json();

    if (!res.ok) {
      setError(JSON.stringify(json));
      return;
    }

    setUploadId(json.id);
    setStatus(json.status ?? "uploaded");
  }

  async function poll() {
    if (!uploadId) return;

    setError("");
    const res = await fetch(`/api/strava/upload-status?uploadId=${uploadId}`);
    const json = await res.json();

    if (!res.ok) {
      setError(JSON.stringify(json));
      return;
    }

    setStatus(json.status ?? "");
    if (json.error) setError(json.error);
    if (json.activity_id) setActivityId(json.activity_id);
  }

  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      <input
        type="file"
        accept=".gpx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <button onClick={upload} disabled={!file}>
        Upload GPX to Strava
      </button>

      <button onClick={poll} disabled={!uploadId}>
        Check upload status
      </button>

      {uploadId && <div>Upload ID: {uploadId}</div>}
      {status && <div>Status: {status}</div>}
      {activityId && (
        <div>
          Activity created: {activityId} (view on Strava)
        </div>
      )}
      {error && <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>}
    </div>
  );
}
