import { GlobalPlaybackProvider } from "@/components/playback/global-playback-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <GlobalPlaybackProvider>{children}</GlobalPlaybackProvider>;
}
