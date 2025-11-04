---
timestamp: 'Sun Nov 02 2025 01:27:07 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_012707.51e2fe80.md]]'
content_id: 8fde887648804343bee96b642ccfdaf23a9a8a0fba4f87fc8399e4d51b30ecc0
---

# file: src/syncs/user\_auth\_syncs.ts (No changes, provided for context)

```typescript
import { actions, Frames, Sync } from "@engine";
import { Requesting, UserAuthentication } from "@concepts";

// --- Common Authentication Flow ---

// Sync for handling user registration request
export const UserRegisterRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, {
      path: "/UserAuthentication/register",
      username,
      password,
    }, { request }],
  ),
  then: actions(
    [UserAuthentication.register, { username, password }],
  ),
});

// Sync for responding to successful user registration
export const UserRegisterResponse: Sync = ({ request, user }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/register" }, {
      request,
    }],
    [UserAuthentication.register, {}, { user }],
  ),
  then: actions(
    [Requesting.respond, { request, user }],
  ),
});

// Sync for responding to failed user registration
export const UserRegisterErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/register" }, {
      request,
    }],
    [UserAuthentication.register, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling user login request
export const UserLoginRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, {
      path: "/UserAuthentication/login",
      username,
      password,
    }, { request }],
  ),
  then: actions(
    [UserAuthentication.login, { username, password }],
  ),
});

// Sync for responding to successful user login
export const UserLoginResponse: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/login" }, { request }],
    [UserAuthentication.login, {}, { token }],
  ),
  then: actions(
    [Requesting.respond, { request, token }],
  ),
});

// Sync for responding to failed user login
export const UserLoginErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/login" }, { request }],
    [UserAuthentication.login, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling user logout request
export const UserLogoutRequest: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/logout", token }, {
      request,
    }],
  ),
  then: actions(
    [UserAuthentication.logout, { token }],
  ),
});

// Sync for responding to successful user logout
export const UserLogoutResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/logout" }, { request }],
    [UserAuthentication.logout, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, { request, message: "Logged out successfully." }], // Custom success message
  ),
});

// Sync for responding to failed user logout
export const UserLogoutErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/logout" }, { request }],
    [UserAuthentication.logout, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// NOTE: The UnauthorizedRequest sync, as originally written, would match
// if a Requesting.request action *then* caused a UserAuthentication.verify action
// to occur which *then* returned an error.
// With the changes below, UserAuthentication.verify is called *within the where clause*
// and thus does NOT create a UserAuthentication.verify action in the event history.
// This means the UnauthorizedRequest sync below will likely *not* fire for AnimalIdentity routes.
// A more general unauthorized handling would require a sync that explicitly performs verify
// for *all* requests with sessions and then creates a specific "AuthFailed" action
// that other syncs can react to. For now, we'll keep it as-is but note its reduced scope.
export const UnauthorizedRequest: Sync = (
  { request, session, errorMessage },
) => ({
  when: actions(
    [Requesting.request, { session }, { request }], // A request comes in with a 'session'
    [UserAuthentication.verify, { token: session }, { error: errorMessage }],
  ),
  then: actions(
    [Requesting.respond, { request, error: errorMessage }], // Respond with the bound error message.
  ),
});
```
