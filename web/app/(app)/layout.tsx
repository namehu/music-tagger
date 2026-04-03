import { GlobalPlaybackProvider } from "@/components/playback/global-playback-provider";
import { AppShell } from "@/components/shell/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalPlaybackProvider>
      <AppShell>{children}</AppShell>
    </GlobalPlaybackProvider>
  );
}
