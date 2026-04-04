import { AppShell } from "@/components/shell/app-shell";
import { getAdminViewerOrRedirect } from "@/lib/viewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAdminViewerOrRedirect();
  return (
    <AppShell shellKind="admin" viewer={viewer}>
      {children}
    </AppShell>
  );
}
