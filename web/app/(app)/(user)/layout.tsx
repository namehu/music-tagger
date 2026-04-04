import { AppShell } from "@/components/shell/app-shell";
import { getViewerOrRedirect } from "@/lib/viewer";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewerOrRedirect();
  return (
    <AppShell shellKind="user" viewer={viewer}>
      {children}
    </AppShell>
  );
}
