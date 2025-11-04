import { actions, Sync } from "@engine";
// Corrected import: UserAuthentication
import { Requesting, UserAuthentication } from "@concepts";

// --- Common Authentication Flow --- // Corrected spelling

// Sync for handling user registration request
export const UserRegisterRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, {
      path: "/UserAuthentication/register", // Corrected path
      username,
      password,
    }, { request }],
  ),
  then: actions(
    [UserAuthentication.register, { username, password }], // Corrected concept name
  ),
});

// Sync for responding to successful user registration
export const UserRegisterResponse: Sync = ({ request, user }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/register" }, { // Corrected path
      request,
    }],
    [UserAuthentication.register, {}, { user }], // Corrected concept name
  ),
  then: actions(
    [Requesting.respond, { request, user }],
  ),
});

// Sync for responding to failed user registration
export const UserRegisterErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/register" }, { // Corrected path
      request,
    }],
    [UserAuthentication.register, {}, { error }], // Corrected concept name
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling user login request
export const UserLoginRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, {
      path: "/UserAuthentication/login", // Corrected path
      username,
      password,
    }, { request }],
  ),
  then: actions(
    [UserAuthentication.login, { username, password }], // Corrected concept name
  ),
});

// Sync for responding to successful user login
export const UserLoginResponse: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/login" }, { request }], // Corrected path
    [UserAuthentication.login, {}, { token }], // Corrected concept name
  ),
  then: actions(
    [Requesting.respond, { request, token }],
  ),
});

// Sync for responding to failed user login
export const UserLoginErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/login" }, { request }], // Corrected path
    [UserAuthentication.login, {}, { error }], // Corrected concept name
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling user logout request
export const UserLogoutRequest: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/logout", token }, { // Corrected path
      request,
    }],
  ),
  then: actions(
    [UserAuthentication.logout, { token }], // Corrected concept name
  ),
});

// Sync for responding to successful user logout
export const UserLogoutResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/logout" }, { request }], // Corrected path
    [UserAuthentication.logout, {}, {}], // Corrected concept name
  ),
  then: actions(
    [Requesting.respond, { request, message: "Logged out successfully." }], // Custom success message
  ),
});

// Sync for responding to failed user logout
export const UserLogoutErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/UserAuthentication/logout" }, { request }], // Corrected path
    [UserAuthentication.logout, {}, { error }], // Corrected concept name
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling requests where a session token was provided but verification failed.
export const UnauthorizedRequest: Sync = (
  { request, session, errorMessage },
) => ({
  when: actions(
    [Requesting.request, { session }, { request }], // A request comes in with a 'session'
    [UserAuthentication.verify, { token: session }, { error: errorMessage }], // Corrected concept name
  ),
  then: actions(
    [Requesting.respond, { request, error: errorMessage }], // Respond with the bound error message.
  ),
});
