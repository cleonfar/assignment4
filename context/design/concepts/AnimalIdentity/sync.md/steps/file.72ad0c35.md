---
timestamp: 'Sun Nov 02 2025 01:42:47 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_014247.763901e0.md]]'
content_id: 72ad0c35948a023eabb7135f0554fac0881c68326eb2c50bb252bd2bd765b05f
---

# file: src/syncs/animal\_identity\_syncs.ts (Refactored for robustness and logging)

```typescript
import { actions, Frames, Sync } from "@engine";
import { AnimalIdentity, Requesting, UserAuthentication } from "@concepts";
import { ID } from "@utils/types.ts";

// Helper function to parse date strings in frames
function parseDateIfString(frames: Frames, dateVar: symbol): Frames {
  return frames.map(($) => {
    const dateVal = $[dateVar];
    if (typeof dateVal === 'string') {
      try {
        const parsedDate = new Date(dateVal);
        if (!isNaN(parsedDate.getTime())) {
          return { ...$, [dateVar]: parsedDate };
        }
      } catch (e) {
        console.warn(`[Date Parsing Warning] Could not parse date string '${dateVal}' for variable ${dateVar.description}. Error: ${e.message}`);
      }
    }
    return $;
  });
}

// --- AnimalIdentity Specific Syncs (Refactored for Authentication in where clause) ---

// --- registerAnimal ---

// Sync for handling animal registration request (SUCCESS PATH)
export const AnimalRegisterRequest: Sync = (
  {
    request,
    session,
    authenticatedUser, // Will be bound in where
    id,
    species,
    sex,
    birthDate, // Will be parsed in where
    breed,
    notes,
  },
) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/AnimalIdentity/registerAnimal",
        session,
        id,
        species,
        sex,
        birthDate,
        breed,
        notes,
      },
      { request },
    ],
  ),
  where: async (frames) => {
    console.log("AnimalRegisterRequest: Starting where clause. Initial frames:", frames.length);
    // 1. Perform authentication check and filter unauthenticated frames
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    console.log("AnimalRegisterRequest: After UserAuthentication.verify. Frames:", frames.length);

    // Filter out unauthenticated frames. These will be picked up by AnimalRegisterAuthErrorResponse.
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    console.log("AnimalRegisterRequest: Authenticated frames after filter:", frames.length);

    if (frames.length === 0) {
      console.log("AnimalRegisterRequest: No authenticated frames remain. Stopping 'then' execution for this sync.");
      return frames;
    }

    // 2. Parse birthDate if it's a string
    frames = parseDateIfString(frames, birthDate);
    console.log("AnimalRegisterRequest: After parseDateIfString. Frames:", frames.length);
    return frames;
  },
  then: actions(
    // Only trigger the AnimalIdentity action. Response will be handled by other syncs.
    [
      AnimalIdentity.registerAnimal,
      { user: authenticatedUser, id, species, sex, birthDate, breed, notes },
    ],
  ),
});

export const AnimalRegisterAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/registerAnimal", session },
      { request },
    ],
  ),
  where: async (frames) => {
    console.log("AnimalRegisterAuthErrorResponse: Starting where clause. Initial frames:", frames.length);
    // Perform authentication check and capture error, keeping only failed authentications
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    console.log("AnimalRegisterAuthErrorResponse: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[`authError`] !== undefined);
    console.log("AnimalRegisterAuthErrorResponse: Frames with auth error:", frames.length);
    return frames;
  },
  then: actions(
    [Requesting.respond, { request, error: authError }],
  ),
});

// AnimalRegisterResponse (handles successful AnimalIdentity.registerAnimal) - unchanged
export const AnimalRegisterResponse: Sync = ({ request, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/registerAnimal" }, {
      request,
    }],
    [AnimalIdentity.registerAnimal, {}, { animal }], // Matches on the output of registerAnimal
  ),
  then: actions(
    [Requesting.respond, { request, animal }],
  ),
});

// AnimalRegisterErrorResponse (handles failed AnimalIdentity.registerAnimal) - unchanged
export const AnimalRegisterErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/registerAnimal" }, {
      request,
    }],
    [AnimalIdentity.registerAnimal, {}, { error }], // Matches on the error output of registerAnimal
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- updateStatus (similar logic) ---
export const AnimalUpdateStatusRequest: Sync = (
  { request, session, authenticatedUser, animal, status, notes },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/updateStatus", session, animal, status, notes },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalUpdateStatusRequest: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    console.log("AnimalUpdateStatusRequest: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    console.log("AnimalUpdateStatusRequest: Authenticated frames after filter:", frames.length);
    return frames;
  },
  then: actions([
    AnimalIdentity.updateStatus,
    { user: authenticatedUser, animal, status, notes },
  ]),
});

export const AnimalUpdateStatusAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/updateStatus", session },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalUpdateStatusAuthErrorResponse: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    console.log("AnimalUpdateStatusAuthErrorResponse: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[`authError`] !== undefined);
    console.log("AnimalUpdateStatusAuthErrorResponse: Frames with auth error:", frames.length);
    return frames;
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const AnimalUpdateStatusResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/updateStatus" }, { request }],
    [AnimalIdentity.updateStatus, {}, {}], // Empty result, means success
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal status updated successfully.",
    }],
  ),
});

export const AnimalUpdateStatusErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/updateStatus" }, { request }],
    [AnimalIdentity.updateStatus, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- editDetails (similar logic) ---
export const AnimalEditDetailsRequest: Sync = (
  {
    request,
    session,
    authenticatedUser,
    animal,
    species,
    breed,
    birthDate,
    sex,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/editDetails", session, animal, species, breed, birthDate, sex },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalEditDetailsRequest: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    console.log("AnimalEditDetailsRequest: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    console.log("AnimalEditDetailsRequest: Authenticated frames after filter:", frames.length);
    if (frames.length === 0) return frames;

    frames = parseDateIfString(frames, birthDate);
    console.log("AnimalEditDetailsRequest: After parseDateIfString. Frames:", frames.length);
    return frames;
  },
  then: actions([
    AnimalIdentity.editDetails,
    { user: authenticatedUser, animal, species, breed, birthDate, sex },
  ]),
});

export const AnimalEditDetailsAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/editDetails", session },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalEditDetailsAuthErrorResponse: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    console.log("AnimalEditDetailsAuthErrorResponse: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[`authError`] !== undefined);
    console.log("AnimalEditDetailsAuthErrorResponse: Frames with auth error:", frames.length);
    return frames;
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const AnimalEditDetailsResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/editDetails" }, { request }],
    [AnimalIdentity.editDetails, {}, {}],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal details updated successfully.",
    }],
  ),
});

export const AnimalEditDetailsErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/editDetails" }, { request }],
    [AnimalIdentity.editDetails, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- markAsTransferred (similar logic) ---
export const AnimalMarkAsTransferredRequest: Sync = (
  { request, session, authenticatedUser, animal, date, recipientNotes },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/markAsTransferred", session, animal, date, recipientNotes },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalMarkAsTransferredRequest: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    console.log("AnimalMarkAsTransferredRequest: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    console.log("AnimalMarkAsTransferredRequest: Authenticated frames after filter:", frames.length);
    if (frames.length === 0) return frames;

    frames = parseDateIfString(frames, date);
    console.log("AnimalMarkAsTransferredRequest: After parseDateIfString. Frames:", frames.length);
    return frames;
  },
  then: actions([
    AnimalIdentity.markAsTransferred,
    { user: authenticatedUser, animal, date, recipientNotes },
  ]),
});

export const AnimalMarkAsTransferredAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/markAsTransferred", session },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalMarkAsTransferredAuthErrorResponse: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    console.log("AnimalMarkAsTransferredAuthErrorResponse: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[`authError`] !== undefined);
    console.log("AnimalMarkAsTransferredAuthErrorResponse: Frames with auth error:", frames.length);
    return frames;
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const AnimalMarkAsTransferredResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsTransferred" }, {
      request,
    }],
    [AnimalIdentity.markAsTransferred, {}, {}],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal marked as transferred successfully.",
    }],
  ),
});

export const AnimalMarkAsTransferredErrorResponse: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsTransferred" }, {
      request,
    }],
    [AnimalIdentity.markAsTransferred, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- markAsDeceased (similar logic) ---
export const AnimalMarkAsDeceasedRequest: Sync = (
  { request, session, authenticatedUser, animal, date, cause },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/markAsDeceased", session, animal, date, cause },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalMarkAsDeceasedRequest: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    console.log("AnimalMarkAsDeceasedRequest: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    console.log("AnimalMarkAsDeceasedRequest: Authenticated frames after filter:", frames.length);
    if (frames.length === 0) return frames;

    frames = parseDateIfString(frames, date);
    console.log("AnimalMarkAsDeceasedRequest: After parseDateIfString. Frames:", frames.length);
    return frames;
  },
  then: actions([
    AnimalIdentity.markAsDeceased,
    { user: authenticatedUser, animal, date, cause },
  ]),
});

export const AnimalMarkAsDeceasedAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/markAsDeceased", session },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalMarkAsDeceasedAuthErrorResponse: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    console.log("AnimalMarkAsDeceasedAuthErrorResponse: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[`authError`] !== undefined);
    console.log("AnimalMarkAsDeceasedAuthErrorResponse: Frames with auth error:", frames.length);
    return frames;
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const AnimalMarkAsDeceasedResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsDeceased" }, { request }],
    [AnimalIdentity.markAsDeceased, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { message: "Animal marked as deceased successfully.", request }],
  ),
});

export const AnimalMarkAsDeceasedErrorResponse: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsDeceased" }, { request }],
    [AnimalIdentity.markAsDeceased, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- markAsSold (similar logic) ---
export const AnimalMarkAsSoldRequest: Sync = (
  { request, session, authenticatedUser, animal, date, buyerNotes },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/markAsSold", session, animal, date, buyerNotes },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalMarkAsSoldRequest: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    console.log("AnimalMarkAsSoldRequest: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    console.log("AnimalMarkAsSoldRequest: Authenticated frames after filter:", frames.length);
    if (frames.length === 0) return frames;

    frames = parseDateIfString(frames, date);
    console.log("AnimalMarkAsSoldRequest: After parseDateIfString. Frames:", frames.length);
    return frames;
  },
  then: actions([
    AnimalIdentity.markAsSold,
    { user: authenticatedUser, animal, date, buyerNotes },
  ]),
});

export const AnimalMarkAsSoldAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/markAsSold", session },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalMarkAsSoldAuthErrorResponse: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    console.log("AnimalMarkAsSoldAuthErrorResponse: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[`authError`] !== undefined);
    console.log("AnimalMarkAsSoldAuthErrorResponse: Frames with auth error:", frames.length);
    return frames;
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const AnimalMarkAsSoldResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, message: "Animal marked as sold successfully." }],
  ),
});

export const AnimalMarkAsSoldErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- removeAnimal (similar logic) ---
export const AnimalRemoveRequest: Sync = (
  { request, session, authenticatedUser, animal },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/removeAnimal", session, animal },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalRemoveRequest: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    console.log("AnimalRemoveRequest: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    console.log("AnimalRemoveRequest: Authenticated frames after filter:", frames.length);
    return frames;
  },
  then: actions([
    AnimalIdentity.removeAnimal,
    { user: authenticatedUser, animal },
  ]),
});

export const AnimalRemoveAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/removeAnimal", session },
    { request },
  ]),
  where: async (frames) => {
    console.log("AnimalRemoveAuthErrorResponse: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    console.log("AnimalRemoveAuthErrorResponse: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[`authError`] !== undefined);
    console.log("AnimalRemoveAuthErrorResponse: Frames with auth error:", frames.length);
    return frames;
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const AnimalRemoveResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/removeAnimal" }, { request }],
    [AnimalIdentity.removeAnimal, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, message: "Animal removed successfully." }],
  ),
});

export const AnimalRemoveErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/removeAnimal" }, { request }],
    [AnimalIdentity.removeAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- _getAnimal (Query) ---

// This single sync now handles both success and internal error responses for _getAnimal
export const GetAnimalRequest: Sync = (
  { request, session, authenticatedUser, id, animalDoc, error: animalError }, // Capture 'id' from request
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/_getAnimal", session, id },
    { request },
  ]),
  where: async (frames) => {
    console.log("GetAnimalRequest: Starting where clause. Initial frames:", frames.length);
    // 1. Authenticate user and filter unauthenticated frames
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    console.log("GetAnimalRequest: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    console.log("GetAnimalRequest: Authenticated frames after filter:", frames.length);

    if (frames.length === 0) {
      console.log("GetAnimalRequest: No authenticated frames remain. Stopping 'then' execution for this sync.");
      return frames;
    }

    // 2. Query for the animal and bind results (or error)
    return await frames.mapAsync(async ($) => {
      const animalId = $[id]; // Use the 'id' captured from the request
      const user = $[authenticatedUser] as ID;
      console.log(`GetAnimalRequest: Calling AnimalIdentity._getAnimal for user: ${user}, animalId: ${animalId}`);
      let res: { animal?: AnimalDocument } | { error: string };
      try {
        res = await AnimalIdentity._getAnimal({ user, id: animalId as ID });
        console.log(`GetAnimalRequest: AnimalIdentity._getAnimal returned for user ${user}, animalId ${animalId}:`, res);
      } catch (e) {
        console.error(`GetAnimalRequest: Error calling AnimalIdentity._getAnimal for user ${user}, animalId ${animalId}:`, e);
        res = { error: `Internal server error during _getAnimal: ${e.message || e}` };
      }

      // Explicitly bind only one of animalDoc or animalError to the frame
      if ('animal' in res) {
        return { ...$, [animalDoc]: res.animal, [animalError]: undefined };
      } else {
        return { ...$, [animalDoc]: undefined, [animalError]: res.error };
      }
    });
  },
  then: actions(
    // Respond with whichever field is defined (one will be undefined)
    [Requesting.respond, { request, animal: animalDoc, error: animalError }],
  ),
});

export const GetAnimalAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/_getAnimal", session },
    { request },
  ]),
  where: async (frames) => {
    console.log("GetAnimalAuthErrorResponse: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    console.log("GetAnimalAuthErrorResponse: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[`authError`] !== undefined);
    console.log("GetAnimalAuthErrorResponse: Frames with auth error:", frames.length);
    return frames;
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --- _getAllAnimals (Query) ---

// This single sync now handles both success and internal error responses for _getAllAnimals
export const GetAllAnimalsRequest: Sync = (
  { request, session, authenticatedUser, results, error: animalError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/_getAllAnimals", session },
    { request },
  ]),
  where: async (frames) => {
    console.log("GetAllAnimalsRequest: Starting where clause. Initial frames:", frames.length);
    // 1. Authenticate user and filter unauthenticated frames
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    console.log("GetAllAnimalsRequest: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    console.log("GetAllAnimalsRequest: Authenticated frames after filter:", frames.length);

    if (frames.length === 0) {
      console.log("GetAllAnimalsRequest: No authenticated frames remain. Stopping 'then' execution for this sync.");
      return frames;
    }

    // 2. Query for all AnimalIdentity and bind results (or error)
    return await frames.mapAsync(async ($) => {
      const user = $[authenticatedUser] as ID;
      console.log(`GetAllAnimalsRequest: Calling AnimalIdentity._getAllAnimals for user: ${user}`);
      let res: { animals: AnimalDocument[] } | { error: string };
      try {
        res = await AnimalIdentity._getAllAnimals({ user });
        console.log(`GetAllAnimalsRequest: AnimalIdentity._getAllAnimals returned for user ${user}:`, res);
      } catch (e) {
        console.error(`GetAllAnimalsRequest: Error calling AnimalIdentity._getAllAnimals for user ${user}:`, e);
        res = { error: `Internal server error during _getAllAnimals: ${e.message || e}` };
      }

      // Explicitly bind only one of results or animalError to the frame
      if ('animals' in res) {
        return { ...$, [results]: res.animals, [animalError]: undefined };
      } else {
        return { ...$, [results]: undefined, [animalError]: res.error };
      }
    });
  },
  then: actions(
    // Respond with whichever field is defined
    [Requesting.respond, { request, results, error: animalError }],
  ),
});

export const GetAllAnimalsAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/_getAllAnimals", session },
    { request },
  ]),
  where: async (frames) => {
    console.log("GetAllAnimalsAuthErrorResponse: Starting where clause. Initial frames:", frames.length);
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    console.log("GetAllAnimalsAuthErrorResponse: After UserAuthentication.verify. Frames:", frames.length);
    frames = frames.filter(($) => $[`authError`] !== undefined);
    console.log("GetAllAnimalsAuthErrorResponse: Frames with auth error:", frames.length);
    return frames;
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});
```

With these changes, run your application (`deno run start`) and try the failing `_getAllAnimals` request again.

**How to use the logs:**

When the timeout occurs, check your terminal output for the `console.log` messages.

* **If you see:**
  ```
  GetAllAnimalsRequest: Starting where clause. Initial frames: 1
  GetAllAnimalsRequest: After UserAuthentication.verify. Frames: 1
  GetAllAnimalsRequest: Authenticated frames after filter: 0
  GetAllAnimalsRequest: No authenticated frames remain. Stopping 'then' execution for this sync.
  ```
  This means your authentication is failing, and the `AuthErrorResponse` sync should be picking it up and responding. If it's *still* timing out, then `GetAllAnimalsAuthErrorResponse` itself might be failing or its `then` clause isn't firing, which would be very unusual if `UserAuthentication.verify` works elsewhere. Make sure `UserAuthentication.verify` is indeed returning an `{ error: string }` on failure, not throwing.

* **If you see:**
  ```
  GetAllAnimalsRequest: Starting where clause. Initial frames: 1
  GetAllAnimalsRequest: After UserAuthentication.verify. Frames: 1
  GetAllAnimalsRequest: Authenticated frames after filter: 1
  GetAllAnimalsRequest: Authenticated frames ready for AnimalIdentity query: 1
  GetAllAnimalsRequest: Calling AnimalIdentity._getAllAnimals for user: <your-username>
  ```
  **But you *DO NOT* see the line:**
  ```
  GetAllAnimalsRequest: AnimalIdentity._getAllAnimals returned for user <your-username>: ...
  ```
  This would strongly suggest that the `AnimalIdentityConcept`'s `_getAllAnimals` method itself is hanging or throwing an unhandled error **before** it returns, or that there's a problem with the MongoDB connection from within that concept. The added `try/catch` will now surface this as an `animalError` in the logs, which should then trigger `Requesting.respond` with that error.

This robust logging and error handling should help you pinpoint the exact stage where the execution is getting stuck.
