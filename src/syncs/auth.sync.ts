import { actions, Frames, Sync } from "@engine";
import { Requesting, UserAuthentification } from "@concepts";
// No longer need ID from @utils/types.ts for this file based on current syncs

// --- Common Authentication Flow ---

// Sync for handling user registration request
export const UserRegisterRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/register", username, password }, {
      request,
    }],
  ),
  then: actions(
    [UserAuthentification.register, { username, password }],
  ),
});

// Sync for responding to successful user registration
export const UserRegisterResponse: Sync = ({ request, user }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/register" }, { request }],
    [UserAuthentification.register, {}, { user }],
  ),
  then: actions(
    [Requesting.respond, { request, user }],
  ),
});

// Sync for responding to failed user registration
export const UserRegisterErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/register" }, { request }],
    [UserAuthentification.register, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling user login request
export const UserLoginRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login", username, password }, {
      request,
    }],
  ),
  then: actions(
    [UserAuthentification.login, { username, password }],
  ),
});

// Sync for responding to successful user login
export const UserLoginResponse: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login" }, { request }],
    [UserAuthentification.login, {}, { token }],
  ),
  then: actions(
    [Requesting.respond, { request, token }],
  ),
});

// Sync for responding to failed user login
export const UserLoginErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login" }, { request }],
    [UserAuthentification.login, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling user logout request
export const UserLogoutRequest: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/logout", token }, { request }],
  ),
  then: actions(
    [UserAuthentification.logout, { token }],
  ),
});

// Sync for responding to successful user logout
export const UserLogoutResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/logout" }, { request }],
    [UserAuthentification.logout, {}, {}], // Empty result for successful logout
  ),
  then: actions(
    [Requesting.respond, { request, message: "Logged out successfully." }], // Custom success message
  ),
});

// Sync for responding to failed user logout
export const UserLogoutErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/logout" }, { request }],
    [UserAuthentification.logout, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling requests where a session token was provided but verification failed.
// This sync will *only* respond if a session token was present in the request
// AND UserAuthentification.verify returned an error.
export const UnauthorizedRequest: Sync = (
  { request, session, errorMessage },
) => ({
  when: actions(
    [Requesting.request, { session }, { request }], // A request comes in with a 'session'
    [UserAuthentification.verify, { token: session }, { error: errorMessage }], // And verification failed
  ),
  then: actions(
    [Requesting.respond, { request, error: errorMessage }], // Respond with the bound error message.
  ),
});
