"use client";

export function ConnectStravaButton() {
  function connect() {
    window.location.href = "/api/strava/authorize";
  }

  return <button onClick={connect}>Connect Strava</button>;
}
