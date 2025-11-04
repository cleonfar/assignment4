---
timestamp: 'Sun Nov 02 2025 01:00:14 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_010014.ff5726ec.md]]'
content_id: 2a970f8f0e4eba11053c992f84bb01759eba859ce6a84f1ba00f741301d7b329
---

# file: src/syncs/animal\_identity\_syncs.ts (Refactored)

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
        console.warn(`[Date Parsing Warning] Failed to parse date string '${dateVal}' for variable ${dateVar.description}. Error: ${e}`);
      }
    }
    return $; // Return frame as is if no conversion needed or failed
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
    // 1. Perform authentication check
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    // 2. Only proceed if authentication was successful
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    // 3. Parse birthDate if it's a string
    frames = parseDateIfString(frames, birthDate);
    return frames;
  },
  then: actions(
    [
      AnimalIdentity.registerAnimal,
      { user: authenticatedUser, id, species, sex, birthDate, breed, notes },
    ],
  ),
});

// Sync for responding to authentication failure for registerAnimal
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
    // Perform authentication check and capture error
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: 'dummyUserForErrorPath', error: authError }, // Bind error if it exists
    );
    // Only proceed if authentication failed
    return frames.filter(($) => $[`authError`] !== undefined);
  },
  then: actions(
    [Requesting.respond, { request, error: authError }],
  ),
});

// Sync for responding to successful animal registration (from AnimalIdentity action)
export const AnimalRegisterResponse: Sync = ({ request, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/registerAnimal" }, {
      request,
    }],
    [AnimalIdentity.registerAnimal, {}, { animal }],
  ),
  then: actions(
    [Requesting.respond, { request, animal }],
  ),
});

// Sync for responding to failed animal registration (from AnimalIdentity action)
export const AnimalRegisterErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/registerAnimal" }, {
      request,
    }],
    [AnimalIdentity.registerAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- updateStatus ---

// Sync for handling animal status update request (SUCCESS PATH)
export const AnimalUpdateStatusRequest: Sync = (
  { request, session, authenticatedUser, animal, status, notes },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/updateStatus", session, animal, status, notes },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    return frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
  },
  then: actions(
    [AnimalIdentity.updateStatus, {
      user: authenticatedUser,
      animal,
      status,
      notes,
    }],
  ),
});

// Sync for responding to authentication failure for updateStatus
export const AnimalUpdateStatusAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/updateStatus", session },
      { request },
    ],
  ),
  where: async (frames) => {
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

// Sync for responding to successful animal status update (from AnimalIdentity action)
export const AnimalUpdateStatusResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/updateStatus" }, { request }],
    [AnimalIdentity.updateStatus, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal status updated successfully.",
    }],
  ),
});

// Sync for responding to failed animal status update (from AnimalIdentity action)
export const AnimalUpdateStatusErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/updateStatus" }, { request }],
    [AnimalIdentity.updateStatus, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- editDetails ---

// Sync for handling animal details edit request (SUCCESS PATH)
export const AnimalEditDetailsRequest: Sync = (
  {
    request,
    session,
    authenticatedUser,
    animal,
    species,
    breed,
    birthDate, // Will be parsed in where
    sex,
  },
) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/AnimalIdentity/editDetails",
        session,
        animal,
        species,
        breed,
        birthDate,
        sex,
      },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    frames = parseDateIfString(frames, birthDate); // Parse birthDate
    return frames;
  },
  then: actions(
    [AnimalIdentity.editDetails, {
      user: authenticatedUser,
      animal,
      species,
      breed,
      birthDate,
      sex,
    }],
  ),
});

// Sync for responding to authentication failure for editDetails
export const AnimalEditDetailsAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/editDetails", session },
      { request },
    ],
  ),
  where: async (frames) => {
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

// Sync for responding to successful animal details edit (from AnimalIdentity action)
export const AnimalEditDetailsResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/editDetails" }, { request }],
    [AnimalIdentity.editDetails, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal details updated successfully.",
    }],
  ),
});

// Sync for responding to failed animal details edit (from AnimalIdentity action)
export const AnimalEditDetailsErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/editDetails" }, { request }],
    [AnimalIdentity.editDetails, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- markAsTransferred ---

// Sync for handling animal mark as transferred request (SUCCESS PATH)
export const AnimalMarkAsTransferredRequest: Sync = (
  { request, session, authenticatedUser, animal, date, recipientNotes },
) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/AnimalIdentity/markAsTransferred",
        session,
        animal,
        date,
        recipientNotes,
      },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    frames = parseDateIfString(frames, date); // Parse date
    return frames;
  },
  then: actions(
    [
      AnimalIdentity.markAsTransferred,
      { user: authenticatedUser, animal, date, recipientNotes },
    ],
  ),
});

// Sync for responding to authentication failure for markAsTransferred
export const AnimalMarkAsTransferredAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/markAsTransferred", session },
      { request },
    ],
  ),
  where: async (frames) => {
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

// Sync for responding to successful animal mark as transferred (from AnimalIdentity action)
export const AnimalMarkAsTransferredResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsTransferred" }, {
      request,
    }],
    [AnimalIdentity.markAsTransferred, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal marked as transferred successfully.",
    }],
  ),
});

// Sync for responding to failed animal mark as transferred (from AnimalIdentity action)
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

// --- markAsDeceased ---

// Sync for handling animal mark as deceased request (SUCCESS PATH)
export const AnimalMarkAsDeceasedRequest: Sync = (
  { request, session, authenticatedUser, animal, date, cause },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/markAsDeceased", session, animal, date, cause },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    frames = parseDateIfString(frames, date); // Parse date
    return frames;
  },
  then: actions(
    [AnimalIdentity.markAsDeceased, {
      user: authenticatedUser,
      animal,
      date,
      cause,
    }],
  ),
});

// Sync for responding to authentication failure for markAsDeceased
export const AnimalMarkAsDeceasedAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/markAsDeceased", session },
      { request },
    ],
  ),
  where: async (frames) => {
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

// Sync for responding to successful animal mark as deceased (from AnimalIdentity action)
export const AnimalMarkAsDeceasedResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsDeceased" }, {
      request,
    }],
    [AnimalIdentity.markAsDeceased, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal marked as deceased successfully.",
    }],
  ),
});

// Sync for responding to failed animal mark as deceased (from AnimalIdentity action)
export const AnimalMarkAsDeceasedErrorResponse: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsDeceased" }, {
      request,
    }],
    [AnimalIdentity.markAsDeceased, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- markAsSold ---

// Sync for handling animal mark as sold request (SUCCESS PATH)
export const AnimalMarkAsSoldRequest: Sync = (
  { request, session, authenticatedUser, animal, date, buyerNotes },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/markAsSold", session, animal, date, buyerNotes },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
    frames = parseDateIfString(frames, date); // Parse date
    return frames;
  },
  then: actions(
    [AnimalIdentity.markAsSold, {
      user: authenticatedUser,
      animal,
      date,
      buyerNotes,
    }],
  ),
});

// Sync for responding to authentication failure for markAsSold
export const AnimalMarkAsSoldAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/markAsSold", session },
      { request },
    ],
  ),
  where: async (frames) => {
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

// Sync for responding to successful animal mark as sold (from AnimalIdentity action)
export const AnimalMarkAsSoldResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal marked as sold successfully.",
    }],
  ),
});

// Sync for responding to failed animal mark as sold (from AnimalIdentity action)
export const AnimalMarkAsSoldErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- removeAnimal ---

// Sync for handling animal removal request (SUCCESS PATH)
export const AnimalRemoveRequest: Sync = (
  { request, session, authenticatedUser, animal },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/AnimalIdentity/removeAnimal",
      session,
      animal,
    }, {
      request,
    }],
  ),
  where: async (frames) => {
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    return frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);
  },
  then: actions(
    [AnimalIdentity.removeAnimal, { user: authenticatedUser, animal }],
  ),
});

// Sync for responding to authentication failure for removeAnimal
export const AnimalRemoveAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/removeAnimal", session },
      { request },
    ],
  ),
  where: async (frames) => {
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

// Sync for responding to successful animal removal (from AnimalIdentity action)
export const AnimalRemoveResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/removeAnimal" }, { request }],
    [AnimalIdentity.removeAnimal, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, { request, message: "Animal removed successfully." }],
  ),
});

// Sync for responding to failed animal removal (from AnimalIdentity action)
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

// Sync for handling query for a single animal by ID (SUCCESS PATH)
export const GetAnimalRequest: Sync = (
  { request, session, authenticatedUser, id, animalDoc, error: animalError }, // Renamed error to avoid conflict
) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAnimal", session, id }, {
      request,
    }],
  ),
  where: async (frames) => {
    // 1. Perform authentication check
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    // 2. Only proceed if authentication was successful
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);

    // 3. Query for the animal, passing authenticatedUser (username) as the owner
    //    We need to call the actual concept method here, as _getAnimal is a query (not an action to trigger).
    //    The query returns an object, so we wrap it in an array for `frames.query` compatibility.
    return await frames.query(
      async ({ user, id }: { user: string; id: string }) => {
        const res = await AnimalIdentity._getAnimal({
          user: user as ID, // Cast to ID as per concept expectations
          id: id as ID,
        });
        return [res]; // Wrap the single result object in an array
      },
      { user: authenticatedUser, id }, // Input pattern for the async function
      { animal: animalDoc, error: animalError }, // Output pattern for the async function
    );
  },
  then: actions(), // `then` clause is empty here, as responses are handled by separate syncs below
});

// Sync for responding to authentication failure for _getAnimal
export const GetAnimalAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/_getAnimal", session },
      { request },
    ],
  ),
  where: async (frames) => {
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

// Sync for responding to errors when getting a single animal (from AnimalIdentity query)
export const GetAnimalErrorResponse: Sync = ({ request, animalError }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAnimal" }, { request }],
  ),
  where: (frames) => frames.filter(($) => $[animalError] !== undefined), // Filter on the error returned by the query
  then: actions(
    [Requesting.respond, { request, error: animalError }],
  ),
});

// Sync for responding to successful animal get (from AnimalIdentity query)
export const GetAnimalSuccessResponse: Sync = ({ request, animalDoc }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAnimal" }, { request }],
  ),
  where: (frames) => frames.filter(($) => $[animalDoc] !== undefined), // Filter on the successful animalDoc
  then: actions(
    [Requesting.respond, { request, animal: animalDoc }],
  ),
});

// --- _getAllAnimals (Query) ---

// Sync for handling query for all AnimalIdentity by user (SUCCESS PATH)
export const GetAllAnimalsRequest: Sync = (
  { request, session, authenticatedUser, results, error: animalError }, // Renamed error to avoid conflict
) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAllAnimals", session }, {
      request,
    }],
  ),
  where: async (frames) => {
    // 1. Perform authentication check
    frames = await frames.query(
      UserAuthentication.verify,
      { token: session },
      { user: authenticatedUser, error: 'authError' },
    );
    // 2. Only proceed if authentication was successful
    frames = frames.filter(($) => $[authenticatedUser] !== undefined && $[`authError`] === undefined);

    // 3. Query for all AnimalIdentity owned by the authenticated user.
    //    We need to call the actual concept method here.
    return await frames.query(
      async ({ user }: { user: string }) => {
        const res = await AnimalIdentity._getAllAnimals({ user: user as ID });
        // The _getAllAnimals query returns an object { animals: AnimalDocument[] } or { error: string }
        // We need to return an array of frames, each corresponding to an animal in the results.
        // Or, if we want to return the whole array of animals as 'results', we structure it.
        return [res]; // Wrap the single result object in an array
      },
      { user: authenticatedUser }, // Input pattern for the async function
      { animals: results, error: animalError }, // Output pattern, bind 'animals' to 'results' or 'error'
    );
  },
  then: actions(), // `then` clause is empty here
});

// Sync for responding to authentication failure for _getAllAnimals
export const GetAllAnimalsAuthErrorResponse: Sync = (
  { request, session, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/_getAllAnimals", session },
      { request },
    ],
  ),
  where: async (frames) => {
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

// Sync for responding to errors when getting all AnimalIdentity (from AnimalIdentity query)
export const GetAllAnimalsErrorResponse: Sync = ({ request, animalError }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAllAnimals" }, {
      request,
    }],
  ),
  where: (frames) => frames.filter(($) => $[animalError] !== undefined), // Filter on the error returned by the query
  then: actions(
    [Requesting.respond, { request, error: animalError }],
  ),
});

// Sync for responding to successful get all AnimalIdentity (from AnimalIdentity query)
export const GetAllAnimalsSuccessResponse: Sync = ({ request, results }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAllAnimals" }, {
      request,
    }],
  ),
  where: (frames) => frames.filter(($) => $[results] !== undefined), // Filter on the successful results array
  then: actions(
    [Requesting.respond, { request, results }],
  ),
});

```
