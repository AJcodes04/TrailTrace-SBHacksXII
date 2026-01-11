import { ConnectStravaButton } from "@/components/ConnectStravaButton";
import { UploadGpx } from "@/components/UploadGpx";

export default function SettingsPage() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>Settings</h1>
      <ConnectStravaButton />
      <UploadGpx />
    </main>
  );
}
