import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_ROOT_PATH,
  DEFAULT_SIGNED_IN_PATH,
  LEGACY_SETUP_PATH,
  SIGN_IN_PATH,
  getUnauthorizedAdminRedirectPath,
  resolveSignInCallbackPath,
} from "./app-routes.ts";
import { getProxyRoutingDecision } from "./proxy-routing.ts";

test("resolveSignInCallbackPath falls back to the user dashboard", () => {
  assert.equal(resolveSignInCallbackPath(""), DEFAULT_SIGNED_IN_PATH);
  assert.equal(resolveSignInCallbackPath("   "), DEFAULT_SIGNED_IN_PATH);
  assert.equal(resolveSignInCallbackPath(null), DEFAULT_SIGNED_IN_PATH);
});

test("resolveSignInCallbackPath preserves explicit next paths", () => {
  assert.equal(resolveSignInCallbackPath("/library"), "/library");
  assert.equal(resolveSignInCallbackPath(ADMIN_ROOT_PATH), ADMIN_ROOT_PATH);
  assert.equal(resolveSignInCallbackPath("/admin/jobs?x=1"), "/admin/jobs?x=1");
});

test("resolveSignInCallbackPath rejects unsafe or removed next paths", () => {
  assert.equal(resolveSignInCallbackPath("https://example.com"), DEFAULT_SIGNED_IN_PATH);
  assert.equal(resolveSignInCallbackPath("//example.com/library"), DEFAULT_SIGNED_IN_PATH);
  assert.equal(resolveSignInCallbackPath(SIGN_IN_PATH), DEFAULT_SIGNED_IN_PATH);
  assert.equal(resolveSignInCallbackPath(LEGACY_SETUP_PATH), DEFAULT_SIGNED_IN_PATH);
  assert.equal(resolveSignInCallbackPath(`${LEGACY_SETUP_PATH}/again`), DEFAULT_SIGNED_IN_PATH);
});

test("getUnauthorizedAdminRedirectPath keeps anonymous users on sign-in", () => {
  assert.equal(getUnauthorizedAdminRedirectPath(false), SIGN_IN_PATH);
});

test("getUnauthorizedAdminRedirectPath sends logged-in non-admin users back to dashboard", () => {
  assert.equal(getUnauthorizedAdminRedirectPath(true), DEFAULT_SIGNED_IN_PATH);
});

test("proxy routing sends signed-in users away from sign-in", () => {
  assert.deepEqual(
    getProxyRoutingDecision({
      pathname: SIGN_IN_PATH,
      isLoggedIn: true,
      initialized: true,
    }),
    { type: "redirect", pathname: DEFAULT_SIGNED_IN_PATH },
  );
});

test("proxy routing sends anonymous initialized users to sign-in with next", () => {
  assert.deepEqual(
    getProxyRoutingDecision({
      pathname: "/admin/jobs",
      search: "?x=1",
      isLoggedIn: false,
      initialized: true,
    }),
    {
      type: "redirect",
      pathname: SIGN_IN_PATH,
      searchParams: { next: "/admin/jobs?x=1" },
    },
  );
});

test("proxy routing sends anonymous uninitialized users to the merged sign-in entry", () => {
  assert.deepEqual(
    getProxyRoutingDecision({
      pathname: "/library",
      isLoggedIn: false,
      initialized: false,
    }),
    {
      type: "redirect",
      pathname: SIGN_IN_PATH,
      searchParams: { next: "/library" },
    },
  );
});
