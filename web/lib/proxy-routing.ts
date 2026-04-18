import { DEFAULT_SIGNED_IN_PATH, SIGN_IN_PATH } from "./app-routes.ts";

type ProxyRoutingInput = {
  pathname: string;
  search?: string;
  isLoggedIn: boolean;
  initialized: boolean;
};

export type ProxyRoutingDecision =
  | { type: "next" }
  | {
      type: "redirect";
      pathname: string;
      searchParams?: Record<string, string>;
    };

export function getProxyRoutingDecision(input: ProxyRoutingInput): ProxyRoutingDecision {
  const search = input.search ?? "";

  if (input.isLoggedIn) {
    if (input.pathname === SIGN_IN_PATH) {
      return { type: "redirect", pathname: DEFAULT_SIGNED_IN_PATH };
    }
    return { type: "next" };
  }

  if (input.pathname === SIGN_IN_PATH) {
    return { type: "next" };
  }

  const next = `${input.pathname}${search}`;
  return {
    type: "redirect",
    pathname: SIGN_IN_PATH,
    searchParams: input.initialized ? { next } : next === SIGN_IN_PATH ? undefined : { next },
  };
}
