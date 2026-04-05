import { PlaybackRuntime } from "@/components/playback/playback-runtime";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PlaybackRuntime />
      {children}
    </>
  );
}
