import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_ROOT_PATH,
  DEFAULT_SIGNED_IN_PATH,
  SIGN_IN_PATH,
  getUnauthorizedAdminRedirectPath,
  resolveSignInCallbackPath,
} from "./app-routes.ts";

test("resolveSignInCallbackPath falls back to the user dashboard", () => {
  assert.equal(resolveSignInCallbackPath(""), DEFAULT_SIGNED_IN_PATH);
  assert.equal(resolveSignInCallbackPath("   "), DEFAULT_SIGNED_IN_PATH);
  assert.equal(resolveSignInCallbackPath(null), DEFAULT_SIGNED_IN_PATH);
});

test("resolveSignInCallbackPath preserves explicit next paths", () => {
  assert.equal(resolveSignInCallbackPath("/library"), "/library");
  assert.equal(resolveSignInCallbackPath(ADMIN_ROOT_PATH), ADMIN_ROOT_PATH);
});

test("getUnauthorizedAdminRedirectPath keeps anonymous users on sign-in", () => {
  assert.equal(getUnauthorizedAdminRedirectPath(false), SIGN_IN_PATH);
});

test("getUnauthorizedAdminRedirectPath sends logged-in non-admin users back to dashboard", () => {
  assert.equal(getUnauthorizedAdminRedirectPath(true), DEFAULT_SIGNED_IN_PATH);
});
