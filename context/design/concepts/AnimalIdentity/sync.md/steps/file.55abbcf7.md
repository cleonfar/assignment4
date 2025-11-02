---
timestamp: 'Sat Nov 01 2025 21:42:28 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251101_214228.f54c2a29.md]]'
content_id: 55abbcf79f7fce57cd7d7dae671b29f497b5172626979467f731abcf046158ba
---

# file: src/syncs/user\_authentication.sync.ts

```typescript
// These two help you declare synchronizations
import { actions, Sync } from "@engine";
// Choose whatever concepts you have
import { Requesting, UserAuthentication } from "@concepts";
// Ensure AnimalIdentity is also available if needed for cross-concept types, though not directly used here
import { AnimalIdentity } from "@concepts"; // For type definitions if needed, e.g., Animal, User


// --- User Registration Flow ---
export const RegisterUserRequest: Sync = ({ request, username, password, user, error }) => ({
    when: actions(
        [Requesting.request, { path: "/register", method: "POST", username, password }, { request }],
    ),
    then: actions(
        [UserAuthentication.register, { username, password }, { user, error }],
    ),
});

export const RegisterUserResponseSuccess: Sync = ({ request, user }) => ({
    when: actions(
        [Requesting.request, { path: "/register", method: "POST" }, { request }],
        [UserAuthentication.register, {}, { user }],
    ),
    then: actions(
        [Requesting.respond, { request, status: 201, body: { message: "User registered successfully", userId: user } }],
    ),
});

export const RegisterUserResponseError: Sync = ({ request, error }) => ({
    when: actions(
        [Requesting.request, { path: "/register", method: "POST" }, { request }],
        [UserAuthentication.register, {}, { error }],
    ),
    then: actions(
        [Requesting.respond, { request, status: 400, body: { error: `Registration failed: ${error}` } }],
    ),
});


// --- User Login Flow ---
export const LoginUserRequest: Sync = ({ request, username, password, token, error }) => ({
    when: actions(
        [Requesting.request, { path: "/login", method: "POST", username, password }, { request }],
    ),
    then: actions(
        [UserAuthentication.login, { username, password }, { token, error }],
    ),
});

export const LoginUserResponseSuccess: Sync = ({ request, token }) => ({
    when: actions(
        [Requesting.request, { path: "/login", method: "POST" }, { request }],
        [UserAuthentication.login, {}, { token }],
    ),
    then: actions(
        [Requesting.respond, { request, status: 200, body: { message: "Login successful", sessionToken: token } }],
    ),
});

export const LoginUserResponseError: Sync = ({ request, error }) => ({
    when: actions(
        [Requesting.request, { path: "/login", method: "POST" }, { request }],
        [UserAuthentication.login, {}, { error }],
    ),
    then: actions(
        [Requesting.respond, { request, status: 401, body: { error: `Login failed: ${error}` } }],
    ),
});


// --- User Logout Flow ---
export const LogoutUserRequest: Sync = ({ request, session, error }) => ({
    when: actions(
        [Requesting.request, { path: "/logout", method: "POST", session }, { request }],
    ),
    then: actions(
        [UserAuthentication.logout, { token: session }, { error }],
    ),
});

export const LogoutUserResponseSuccess: Sync = ({ request }) => ({
    when: actions(
        [Requesting.request, { path: "/logout", method: "POST" }, { request }],
        [UserAuthentication.logout, {}, {}], // Empty result for success
    ),
    then: actions(
        [Requesting.respond, { request, status: 200, body: { message: "Logout successful" } }],
    ),
});

export const LogoutUserResponseError: Sync = ({ request, error }) => ({
    when: actions(
        [Requesting.request, { path: "/logout", method: "POST" }, { request }],
        [UserAuthentication.logout, {}, { error }],
    ),
    then: actions(
        [Requesting.respond, { request, status: 400, body: { error: `Logout failed: ${error}` } }],
    ),
});
```

***

### Syncs for Animal Identity (User Scoped)

These synchronizations handle requests for managing animals, ensuring that actions are performed by an authenticated user and on their own animals.
