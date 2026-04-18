export const DEFAULT_SIGNED_IN_PATH = "/dashboard";
export const ADMIN_ROOT_PATH = "/admin";
export const SIGN_IN_PATH = "/sign-in";
export const LEGACY_SETUP_PATH = "/setup";

export function resolveInternalCallbackPath(nextFromQuery: string | null | undefined) {
  const trimmed = nextFromQuery?.trim() ?? "";
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_SIGNED_IN_PATH;
  }

  let url: URL;
  try {
    url = new URL(trimmed, "http://local.music-tagger");
  } catch {
    return DEFAULT_SIGNED_IN_PATH;
  }

  const path = url.pathname;
  if (path === SIGN_IN_PATH || path === LEGACY_SETUP_PATH || path.startsWith(`${LEGACY_SETUP_PATH}/`)) {
    return DEFAULT_SIGNED_IN_PATH;
  }

  return `${path}${url.search}${url.hash}`;
}

export function resolveSignInCallbackPath(nextFromQuery: string | null | undefined) {
  return resolveInternalCallbackPath(nextFromQuery);
}

export function getUnauthorizedAdminRedirectPath(isLoggedIn: boolean) {
  return isLoggedIn ? DEFAULT_SIGNED_IN_PATH : SIGN_IN_PATH;
}
