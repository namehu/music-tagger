import { getAdminInitializationStatus } from "@/lib/admin-init";

import { SignInClientPage } from "./sign-in-client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const [params, status] = await Promise.all([
    Promise.resolve(searchParams ?? {}),
    getAdminInitializationStatus(),
  ]);

  return (
    <SignInClientPage
      initialEmail={readSearchParam(params.email)}
      initialInitialized={status.initialized}
      initialState={status.state}
      nextFromQuery={readSearchParam(params.next)}
    />
  );
}
