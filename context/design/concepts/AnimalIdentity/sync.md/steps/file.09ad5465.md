---
timestamp: 'Sat Nov 01 2025 21:14:59 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251101_211459.cd6018f9.md]]'
content_id: 09ad5465aa2b842fbd3eab1c573d5be4441969f0aaa62811c2a9dea4deb684b9
---

# file: src/syncs/UserAndAnimalSyncs.sync.ts

```typescript
// These two help you declare synchronizations
import { actions, Sync, Frames } from "@engine";
// Choose whatever concepts you have
import { Requesting, UserAuthentication, AnimalIdentity } from "@concepts"; // Assuming @concepts points to the right place and includes these.

// Define variable types for clarity (these are symbols in practice, but typed here for context)
type User = string; // As defined in AnimalIdentityConcept (ID is string)
type Animal = string; // As defined in AnimalIdentityConcept (ID is string)
type Request = string; // As defined by Requesting concept (ID is string)
type SessionToken = string; // As defined by UserAuthentication concept (ID is string)

// ===========================================
// UserAuthentication Concept Synchronizations
// ===========================================

// --- User Registration Flow ---

/**
 * Sync: Handles an incoming HTTP request to register a new user.
 * Maps the request parameters to the UserAuthentication.register action.
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
    [Requesting.respond, { request, status: 201, body: { user } }],
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
 * Maps the request parameters to the UserAuthentication.login action.
 * Assumes UserAuthentication.login returns { user: User, sessionToken: SessionToken }.
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
 * Matches the original request and the successful output from UserAuthentication.login.
 */
export const UserAuthLoginResponseSuccess: Sync = ({ request, user, sessionToken }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login" }, { request }],
    // Matches successful login output, assuming it provides both user ID and session token
    [UserAuthentication.login, {}, { user, sessionToken }],
  ),
  then: actions(
    [Requesting.respond, { request, status: 200, body: { user, sessionToken } }],
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
    [Requesting.respond, { request, status: 401, body: { error } }], // 401 Unauthorized
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
 */
export const AnimalIdentityRegisterRequest: Sync = (
  { request, sessionToken, id, species, sex, birthDate, breed, notes, user },
) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/animals/register",
        sessionToken, // Assumed to be passed in request (e.g., header, body)
        id, species, sex, birthDate, breed, notes,
      },
      { request },
    ],
  ),
  where: async (frames) => {
    // Step 1: Verify the session token and bind the user ID
    frames = await frames.query(UserAuthentication.verify, { token: sessionToken }, { user });
    return frames; // If verification fails, 'frames' will be empty and 'then' won't fire
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
    [AnimalIdentity.registerAnimal, {}, { animal }], // Matches successful output
  ),
  then: actions(
    [Requesting.respond, { request, status: 201, body: { animal } }],
  ),
});

/**
 * Sync: Responds to an error during animal registration.
 * Matches the original request and the error output from AnimalIdentity.registerAnimal.
 */
export const AnimalIdentityRegisterResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/register" }, { request }],
    [AnimalIdentity.registerAnimal, {}, { error }], // Matches error output
  ),
  then: actions(
    [Requesting.respond, { request, status: 400, body: { error } }],
  ),
});

// --- Get All Animals Flow ---

/**
 * Sync: Handles an incoming HTTP request to get all animals for the authenticated user.
 * Verifies the session token, then queries AnimalIdentity for all animals owned by that user.
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
      frames = await frames.query(AnimalIdentity._getAllAnimals, { user }, { animals });
    }

    // Handle case where _getAllAnimals returns an empty array for `animals` (no animals found)
    // The query method should ensure that if there are no animals, the 'animals' variable
    // is bound to an empty array within the existing frame, allowing the `then` clause to fire.
    // So, no explicit `if (frames.length === 0)` handling is typically needed here
    // *unless* `_getAllAnimals` itself errors out or returns literally zero frames instead of `animals: []`.
    return frames;
  },
  then: actions(
    [Requesting.respond, { request, status: 200, body: { animals } }],
  ),
});

// --- Edit Animal Details Flow ---

/**
 * Sync: Handles an incoming HTTP request to edit an animal's details for a user.
 * Verifies the session token, then calls AnimalIdentity.editDetails.
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
    // Step 1: Verify the session token and bind the user ID
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
    // Step 1: Verify the session token and bind the user ID
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
// These follow a very similar pattern to editDetails.
// I'll provide one example, the others would be analogous.

/**
 * Sync: Handles an incoming HTTP request to mark an animal as transferred.
 * Verifies the session token, then calls AnimalIdentity.markAsTransferred.
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
        date,
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

// Analogous syncs would be created for markAsDeceased and markAsSold.
```
