---
timestamp: 'Sun Nov 02 2025 01:27:07 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_012707.51e2fe80.md]]'
content_id: d9d0b99bdced91db4379dc0e884489fc2ebd80e41fa7ec6a1ec8d1135d641082
---

# file: src/syncs/animal\_identity\_syncs.ts (Refactored for query response handling)

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
    // 1. Perform authentication check and filter unauthenticated frames
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    // Filter out unauthenticated frames. These will be picked up by AnimalRegisterAuthErrorResponse.
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);

    // If no authenticated frames, this sync's 'then' won't fire for these frames.
    if (frames.length === 0) return frames; 

    // 2. Parse birthDate if it's a string
    frames = parseDateIfString(frames, birthDate);
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
    // Perform authentication check and capture error, keeping only failed authentications
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError }, 
    );
    return frames.filter(($) => $[`authError`] !== undefined);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    return frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    return frames.filter(($) => $[`authError`] !== undefined);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    if (frames.length === 0) return frames; 

    frames = parseDateIfString(frames, birthDate);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    return frames.filter(($) => $[`authError`] !== undefined);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    if (frames.length === 0) return frames;

    frames = parseDateIfString(frames, date);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    return frames.filter(($) => $[`authError`] !== undefined);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    if (frames.length === 0) return frames;

    frames = parseDateIfString(frames, date);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    return frames.filter(($) => $[`authError`] !== undefined);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    if (frames.length === 0) return frames;

    frames = parseDateIfString(frames, date);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    return frames.filter(($) => $[`authError`] !== undefined);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    return frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    return frames.filter(($) => $[`authError`] !== undefined);
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
    // 1. Authenticate user and filter unauthenticated frames
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    if (frames.length === 0) return frames; // Stop if no authenticated frames

    // 2. Query for the animal and bind results (or error)
    return await frames.mapAsync(async ($) => {
      const animalId = $[id]; // Use the 'id' captured from the request
      const user = $[authenticatedUser] as ID; 
      
      const res = await AnimalIdentity._getAnimal({ user, id: animalId as ID });
      
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    return frames.filter(($) => $[`authError`] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// Removed GetAnimalErrorResponse and GetAnimalSuccessResponse - their functionality is now in GetAnimalRequest.

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
    // 1. Authenticate user and filter unauthenticated frames
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    if (frames.length === 0) return frames; // Stop if no authenticated frames

    // 2. Query for all AnimalIdentity and bind results (or error)
    return await frames.mapAsync(async ($) => {
      const user = $[authenticatedUser] as ID;
      const res = await AnimalIdentity._getAllAnimals({ user });
      
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
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError },
    );
    return frames.filter(($) => $[`authError`] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// Removed GetAllAnimalsErrorResponse and GetAllAnimalsSuccessResponse - their functionality is now in GetAllAnimalsRequest.
```
