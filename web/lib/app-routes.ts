export const DEFAULT_SIGNED_IN_PATH = "/dashboard";
export const ADMIN_ROOT_PATH = "/admin";
export const SIGN_IN_PATH = "/sign-in";

export function resolveSignInCallbackPath(nextFromQuery: string | null | undefined) {
  const trimmed = nextFromQuery?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : DEFAULT_SIGNED_IN_PATH;
}

export function getUnauthorizedAdminRedirectPath(isLoggedIn: boolean) {
  return isLoggedIn ? DEFAULT_SIGNED_IN_PATH : SIGN_IN_PATH;
}
