---
timestamp: 'Sat Nov 01 2025 21:40:20 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251101_214020.1b9ed27f.md]]'
content_id: 6ce0de5a03696ff9309b4d049b6ef43c59e36da66c16cf779b6cea35d33dbc43
---

# file: src/syncs/UserAndAnimalSyncs.sync.ts

```typescript
// These two help you declare synchronizations
import { actions, Sync, Frames } from "@engine";
// Choose whatever concepts you have. Assumes these are correctly imported from your @concepts alias.
import { Requesting, UserAuthentication, AnimalIdentity } from "@concepts";

// Define variable types for clarity (these are symbols in practice, but typed here for context)
type User = string; // As ID from @utils/types.ts, which is a branded string
type Animal = string; // As ID from @utils/types.ts
type Request = string; // As ID from @utils/types.ts
type SessionToken = string; // As ID from @utils/types.ts

// ===========================================
// UserAuthentication Concept Synchronizations
// ===========================================

// --- User Registration Flow ---

/**
 * Sync: Handles an incoming HTTP request to register a new user.
 * Maps the request parameters (username, password) to the UserAuthentication.register action.
 */
export const UserAuthRegisterRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/register", username, password }, { request }],
  ),
  then: actions(
    [UserAuthentication.register, { username, password }],
  ),
});

/**
 * Sync: Responds to a successful user registration.
 * Matches the original request and the successful output from UserAuthentication.register.
 */
export const UserAuthRegisterResponseSuccess: Sync = ({ request, user }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/register" }, { request }],
    [UserAuthentication.register, {}, { user }], // Matches successful registration output
  ),
  then: actions(
    [Requesting.respond, { request, status: 201, body: { userId: user } }], // Renamed 'user' to 'userId' for clarity in response body
  ),
});

/**
 * Sync: Responds to an error during user registration.
 * Matches the original request and the error output from UserAuthentication.register.
 */
export const UserAuthRegisterResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/register" }, { request }],
    [UserAuthentication.register, {}, { error }], // Matches error registration output
  ),
  then: actions(
    [Requesting.respond, { request, status: 400, body: { error } }],
  ),
});

// --- User Login Flow ---

/**
 * Sync: Handles an incoming HTTP request to log in a user.
 * Maps the request parameters (username, password) to the UserAuthentication.login action.
 */
export const UserAuthLoginRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login", username, password }, { request }],
  ),
  then: actions(
    [UserAuthentication.login, { username, password }],
  ),
});

/**
 * Sync: Responds to a successful user login.
 * Matches the original request and the successful output (session token) from UserAuthentication.login.
 */
export const UserAuthLoginResponseSuccess: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login" }, { request }],
    [UserAuthentication.login, {}, { token }], // Matches successful login output
  ),
  then: actions(
    [Requesting.respond, { request, status: 200, body: { sessionToken: token } }],
  ),
});

/**
 * Sync: Responds to an error during user login.
 * Matches the original request and the error output from UserAuthentication.login.
 */
export const UserAuthLoginResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login" }, { request }],
    [UserAuthentication.login, {}, { error }], // Matches error login output
  ),
  then: actions(
    [Requesting.respond, { request, status: 401, body: { error } }], // 401 Unauthorized for login failures
  ),
});

// --- User Logout Flow ---

/**
 * Sync: Handles an incoming HTTP request to log out a user.
 * Maps the request's session token to the UserAuthentication.logout action.
 */
export const UserAuthLogoutRequest: Sync = ({ request, sessionToken }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/logout", sessionToken }, { request }],
  ),
  then: actions(
    [UserAuthentication.logout, { token: sessionToken }],
  ),
});

/**
 * Sync: Responds to a successful user logout.
 * Matches the original request and the successful (empty) output from UserAuthentication.logout.
 */
export const UserAuthLogoutResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/logout" }, { request }],
    [UserAuthentication.logout, {}, {}], // Matches successful logout (empty return)
  ),
  then: actions(
    [Requesting.respond, { request, status: 200, body: { message: "Logged out successfully." } }],
  ),
});

/**
 * Sync: Responds to an error during user logout.
 * Matches the original request and the error output from UserAuthentication.logout.
 */
export const UserAuthLogoutResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/logout" }, { request }],
    [UserAuthentication.logout, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, status: 400, body: { error } }],
  ),
});


// ===========================================
// AnimalIdentity Concept Synchronizations (User-Scoped)
// ===========================================

// --- Animal Registration Flow ---

/**
 * Sync: Handles an incoming HTTP request to register an animal for a user.
 * Verifies the session token to get the user ID, then calls AnimalIdentity.registerAnimal.
 * Expected request body: { sessionToken, id, species, sex, birthDate?, breed?, notes? }
 */
export const AnimalIdentityRegisterRequest: Sync = (
  { request, sessionToken, id, species, sex, birthDate, breed, notes, user },
) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/animals/register",
        sessionToken, // Assumed to be passed in request body/headers for authentication
        id, species, sex, birthDate, breed, notes,
      },
      { request },
    ],
  ),
  where: async (frames) => {
    // Step 1: Verify the session token and bind the user ID
    // If verification fails (e.g., token invalid), 'frames' will become empty
    frames = await frames.query(UserAuthentication.verify, { token: sessionToken }, { user });
    return frames;
  },
  then: actions(
    [AnimalIdentity.registerAnimal, { user, id, species, sex, birthDate, breed, notes }],
  ),
});

/**
 * Sync: Responds to a successful animal registration.
 * Matches the original request and the successful output from AnimalIdentity.registerAnimal.
 */
export const AnimalIdentityRegisterResponseSuccess: Sync = ({ request, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/register" }, { request }],
    [AnimalIdentity.registerAnimal, {}, { animal }], // Matches successful output: { animal: AnimalID }
  ),
  then: actions(
    [Requesting.respond, { request, status: 201, body: { animalId: animal } }],
  ),
});

/**
 * Sync: Responds to an error during animal registration.
 * Matches the original request and the error output from AnimalIdentity.registerAnimal.
 */
export const AnimalIdentityRegisterResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/register" }, { request }],
    [AnimalIdentity.registerAnimal, {}, { error }], // Matches error output: { error: string }
  ),
  then: actions(
    [Requesting.respond, { request, status: 400, body: { error } }],
  ),
});

// --- Get All Animals Flow ---

/**
 * Sync: Handles an incoming HTTP request to get all animals for the authenticated user.
 * Verifies the session token, then queries AnimalIdentity for all animals owned by that user.
 * Expected request body: { sessionToken }
 */
export const AnimalIdentityGetAllRequest: Sync = ({ request, sessionToken, user, animals }) => ({
  when: actions(
    [Requesting.request, { path: "/animals", sessionToken }, { request }],
  ),
  where: async (frames) => {
    // Step 1: Verify the session token and bind the user ID
    frames = await frames.query(UserAuthentication.verify, { token: sessionToken }, { user });

    // If authentication failed, frames will be empty. If successful, query for animals.
    if (frames.length > 0) {
      // The _getAllAnimals query from the concept is expected to return { animals: AnimalDocument[] }
      // The `animals` variable will be bound to this array, even if empty.
      frames = await frames.query(AnimalIdentity._getAllAnimals, { user }, { animals });
    }
    return frames;
  },
  then: actions(
    [Requesting.respond, { request, status: 200, body: { animals } }],
  ),
});

// Note: An explicit error sync for `_getAllAnimals` might not be strictly necessary
// if `_getAllAnimals` itself handles its own errors by returning `{ error: string }`
// and the main `AnimalIdentityGetAllRequest` where clause handles the empty frames
// from `UserAuthentication.verify` (which is covered). If `_getAllAnimals` can
// return an error, you'd add another response sync. For now, assuming it returns `animals: []` on no results.

// --- Edit Animal Details Flow ---

/**
 * Sync: Handles an incoming HTTP request to edit an animal's details for a user.
 * Verifies the session token, then calls AnimalIdentity.editDetails.
 * Expected request body: { sessionToken, animalId, species, breed, birthDate, sex }
 */
export const AnimalIdentityEditDetailsRequest: Sync = (
  { request, sessionToken, animalId, species, breed, birthDate, sex, user },
) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/animals/edit",
        sessionToken,
        animalId, // The ID of the animal to edit, passed in request
        species, breed, birthDate, sex,
      },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(UserAuthentication.verify, { token: sessionToken }, { user });
    return frames;
  },
  then: actions(
    [
      AnimalIdentity.editDetails,
      { user, animal: animalId, species, breed, birthDate, sex },
    ],
  ),
});

/**
 * Sync: Responds to a successful animal details edit.
 * Matches the original request and the successful (empty) output from AnimalIdentity.editDetails.
 */
export const AnimalIdentityEditDetailsResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/edit" }, { request }],
    [AnimalIdentity.editDetails, {}, {}], // Matches successful output (empty)
  ),
  then: actions(
    [Requesting.respond, { request, status: 200, body: { message: "Animal details updated successfully." } }],
  ),
});

/**
 * Sync: Responds to an error during animal details edit.
 * Matches the original request and the error output from AnimalIdentity.editDetails.
 */
export const AnimalIdentityEditDetailsResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/edit" }, { request }],
    [AnimalIdentity.editDetails, {}, { error }], // Matches error output
  ),
  then: actions(
    [Requesting.respond, { request, status: 400, body: { error } }],
  ),
});

// --- Remove Animal Flow ---

/**
 * Sync: Handles an incoming HTTP request to remove an animal for a user.
 * Verifies the session token, then calls AnimalIdentity.removeAnimal.
 * Expected request body: { sessionToken, animalId }
 */
export const AnimalIdentityRemoveRequest: Sync = ({ request, sessionToken, animalId, user }) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/animals/remove",
        sessionToken,
        animalId, // The ID of the animal to remove, passed in request
      },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(UserAuthentication.verify, { token: sessionToken }, { user });
    return frames;
  },
  then: actions(
    [AnimalIdentity.removeAnimal, { user, animal: animalId }],
  ),
});

/**
 * Sync: Responds to a successful animal removal.
 * Matches the original request and the successful (empty) output from AnimalIdentity.removeAnimal.
 */
export const AnimalIdentityRemoveResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/remove" }, { request }],
    [AnimalIdentity.removeAnimal, {}, {}], // Matches successful output (empty)
  ),
  then: actions(
    [Requesting.respond, { request, status: 200, body: { message: "Animal removed successfully." } }],
  ),
});

/**
 * Sync: Responds to an error during animal removal.
 * Matches the original request and the error output from AnimalIdentity.removeAnimal.
 */
export const AnimalIdentityRemoveResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/remove" }, { request }],
    [AnimalIdentity.removeAnimal, {}, { error }], // Matches error output
  ),
  then: actions(
    [Requesting.respond, { request, status: 400, body: { error } }],
  ),
});

// --- Mark Animal Status Actions (Transferred, Deceased, Sold) ---
// These actions follow a very similar pattern:
// 1. A Requesting.request comes in with sessionToken and relevant details.
// 2. A 'where' clause verifies the sessionToken to get the 'user'.
// 3. The 'then' clause calls the appropriate AnimalIdentity action with 'user' and other details.
// 4. Success/Error response syncs match the original request and the action's output.

/**
 * Sync: Handles an incoming HTTP request to mark an animal as transferred.
 * Verifies the session token, then calls AnimalIdentity.markAsTransferred.
 * Expected request body: { sessionToken, animalId, date, recipientNotes? }
 */
export const AnimalIdentityMarkAsTransferredRequest: Sync = (
  { request, sessionToken, animalId, date, recipientNotes, user },
) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/animals/mark-transferred",
        sessionToken,
        animalId,
        date, // Assumed to be a Date object, or string that Requesting parses to Date
        recipientNotes,
      },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(UserAuthentication.verify, { token: sessionToken }, { user });
    return frames;
  },
  then: actions(
    [AnimalIdentity.markAsTransferred, { user, animal: animalId, date, recipientNotes }],
  ),
});

/**
 * Sync: Responds to a successful marking of an animal as transferred.
 */
export const AnimalIdentityMarkAsTransferredResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/mark-transferred" }, { request }],
    [AnimalIdentity.markAsTransferred, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: 200, body: { message: "Animal marked as transferred successfully." } }],
  ),
});

/**
 * Sync: Responds to an error during marking an animal as transferred.
 */
export const AnimalIdentityMarkAsTransferredResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/mark-transferred" }, { request }],
    [AnimalIdentity.markAsTransferred, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, status: 400, body: { error } }],
  ),
});

// Analogous syncs would be created for:
// - markAsDeceased (Request, ResponseSuccess, ResponseError)
// - markAsSold (Request, ResponseSuccess, ResponseError)
// The structure would be identical to markAsTransferred, just changing the path and the AnimalIdentity action.
```
