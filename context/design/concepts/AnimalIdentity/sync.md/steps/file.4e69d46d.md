---
timestamp: 'Sat Nov 01 2025 21:48:48 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251101_214848.3c1f98c7.md]]'
content_id: 4e69d46d7428f24cef8d046249e2daa3ec978e785d3a6746482d67ea7757b020
---

# file: src/syncs/animal\_identity.sync.ts (Updated for Username Context)

```typescript
// These two help you declare synchronizations
import { actions, Sync, Frames } from "@engine";
// Choose whatever concepts you have
import { Requesting, UserAuthentication, AnimalIdentity } from "@concepts";
import { ID } from "@utils/types.ts"; // For general ID type


// Simplified helper for authentication. It now directly provides the username.
const authenticateAndGetUsername = async (
    frames: Frames,
    sessionVar: symbol,
    usernameVar: symbol,
) => {
    // 1. Verify session token to get username
    // Note: UserAuthentication.verify already returns 'username' directly.
    frames = await frames.query(UserAuthentication.verify, { token: frames[0][sessionVar] as ID }, { username: usernameVar });
    // If verification failed (no username), frames will be empty.
    return frames;
};


// --- Register Animal Request Flow ---
export const RegisterAnimalForUserRequest: Sync = (
    { request, session, animalId, species, sex, birthDate, breed, notes, ownerUsername, error, animal }, // Renamed userId to ownerUsername
) => ({
    when: actions(
        [Requesting.request, {
            path: "/animals/register",
            method: "POST",
            session,
            id: animalId, // animalId is the user-provided ID
            species,
            sex,
            birthDate,
            breed,
            notes,
        }, { request }],
    ),
    where: async (frames) => {
        // Capture original request frame for responding in case of auth failure
        const originalFrame = frames[0];
        // Authenticate and get the owner's username
        frames = await authenticateAndGetUsername(frames, session, ownerUsername);

        if (frames.length === 0) {
            // Authentication failed, respond with error
            return new Frames({
                ...originalFrame,
                [error]: "Authentication required or invalid session."
            });
        }
        return frames;
    },
    then: actions(
        // On success, register the animal with the identified ownerUsername
        [AnimalIdentity.registerAnimal, {
            ownerUsername, // Now directly passing the username
            id: animalId,
            species,
            sex,
            birthDate,
            breed,
            notes,
        }, { animal, error }], // animal for success, error for failure
        // Respond to the request
        [Requesting.respond, {
            request,
            status: error ? 400 : 201, // 400 if AnimalIdentity.registerAnimal returned error, 201 if successful
            body: error ? { error } : { message: `Animal '${animalId}' registered successfully by user '${ownerUsername}'`, animalId: animal },
        }],
    ),
});


// --- Update Animal Status Request Flow ---
export const UpdateAnimalStatusForUserRequest: Sync = (
    { request, session, animalId, status, notes, ownerUsername, error }, // Renamed userId to ownerUsername
) => ({
    when: actions(
        [Requesting.request, {
            path: `/animals/${animalId}/status`,
            method: "PUT",
            session,
            status,
            notes,
        }, { request }],
    ),
    where: async (frames) => {
        const originalFrame = frames[0];
        frames = await authenticateAndGetUsername(frames, session, ownerUsername);
        if (frames.length === 0) {
            return new Frames({ ...originalFrame, [error]: "Authentication required or invalid session." });
        }
        return frames;
    },
    then: actions(
        [AnimalIdentity.updateStatus, { ownerUsername, animal: animalId, status, notes }, { error }],
        [Requesting.respond, {
            request,
            status: error ? 400 : 200,
            body: error ? { error } : { message: `Animal '${animalId}' status updated successfully.` },
        }],
    ),
});


// --- Edit Animal Details Request Flow ---
export const EditAnimalDetailsForUserRequest: Sync = (
    { request, session, animalId, species, breed, birthDate, sex, ownerUsername, error }, // Renamed userId to ownerUsername
) => ({
    when: actions(
        [Requesting.request, {
            path: `/animals/${animalId}/details`,
            method: "PUT",
            session,
            species,
            breed,
            birthDate,
            sex,
        }, { request }],
    ),
    where: async (frames) => {
        const originalFrame = frames[0];
        frames = await authenticateAndGetUsername(frames, session, ownerUsername);
        if (frames.length === 0) {
            return new Frames({ ...originalFrame, [error]: "Authentication required or invalid session." });
        }
        return frames;
    },
    then: actions(
        [AnimalIdentity.editDetails, { ownerUsername, animal: animalId, species, breed, birthDate, sex }, { error }],
        [Requesting.respond, {
            request,
            status: error ? 400 : 200,
            body: error ? { error } : { message: `Animal '${animalId}' details updated successfully.` },
        }],
    ),
});


// --- Mark Animal as Transferred Request Flow ---
export const MarkAnimalAsTransferredForUserRequest: Sync = (
    { request, session, animalId, date, recipientNotes, ownerUsername, error }, // Renamed userId to ownerUsername
) => ({
    when: actions(
        [Requesting.request, {
            path: `/animals/${animalId}/markAsTransferred`,
            method: "PUT",
            session,
            date,
            recipientNotes,
        }, { request }],
    ),
    where: async (frames) => {
        const originalFrame = frames[0];
        frames = await authenticateAndGetUsername(frames, session, ownerUsername);
        if (frames.length === 0) {
            return new Frames({ ...originalFrame, [error]: "Authentication required or invalid session." });
        }
        return frames;
    },
    then: actions(
        [AnimalIdentity.markAsTransferred, { ownerUsername, animal: animalId, date, recipientNotes }, { error }],
        [Requesting.respond, {
            request,
            status: error ? 400 : 200,
            body: error ? { error } : { message: `Animal '${animalId}' marked as transferred.` },
        }],
    ),
});


// --- Mark Animal as Deceased Request Flow ---
export const MarkAnimalAsDeceasedForUserRequest: Sync = (
    { request, session, animalId, date, cause, ownerUsername, error }, // Renamed userId to ownerUsername
) => ({
    when: actions(
        [Requesting.request, {
            path: `/animals/${animalId}/markAsDeceased`,
            method: "PUT",
            session,
            date,
            cause,
        }, { request }],
    ),
    where: async (frames) => {
        const originalFrame = frames[0];
        frames = await authenticateAndGetUsername(frames, session, ownerUsername);
        if (frames.length === 0) {
            return new Frames({ ...originalFrame, [error]: "Authentication required or invalid session." });
        }
        return frames;
    },
    then: actions(
        [AnimalIdentity.markAsDeceased, { ownerUsername, animal: animalId, date, cause }, { error }],
        [Requesting.respond, {
            request,
            status: error ? 400 : 200,
            body: error ? { error } : { message: `Animal '${animalId}' marked as deceased.` },
        }],
    ),
});


// --- Mark Animal as Sold Request Flow ---
export const MarkAnimalAsSoldForUserRequest: Sync = (
    { request, session, animalId, date, buyerNotes, ownerUsername, error }, // Renamed userId to ownerUsername
) => ({
    when: actions(
        [Requesting.request, {
            path: `/animals/${animalId}/markAsSold`,
            method: "PUT",
            session,
            date,
            buyerNotes,
        }, { request }],
    ),
    where: async (frames) => {
        const originalFrame = frames[0];
        frames = await authenticateAndGetUsername(frames, session, ownerUsername);
        if (frames.length === 0) {
            return new Frames({ ...originalFrame, [error]: "Authentication required or invalid session." });
        }
        return frames;
    },
    then: actions(
        [AnimalIdentity.markAsSold, { ownerUsername, animal: animalId, date, buyerNotes }, { error }],
        [Requesting.respond, {
            request,
            status: error ? 400 : 200,
            body: error ? { error } : { message: `Animal '${animalId}' marked as sold.` },
        }],
    ),
});


// --- Remove Animal Request Flow ---
export const RemoveAnimalForUserRequest: Sync = (
    { request, session, animalId, ownerUsername, error }, // Renamed userId to ownerUsername
) => ({
    when: actions(
        [Requesting.request, {
            path: `/animals/${animalId}/remove`,
            method: "DELETE",
            session,
        }, { request }],
    ),
    where: async (frames) => {
        const originalFrame = frames[0];
        frames = await authenticateAndGetUsername(frames, session, ownerUsername);
        if (frames.length === 0) {
            return new Frames({ ...originalFrame, [error]: "Authentication required or invalid session." });
        }
        return frames;
    },
    then: actions(
        [AnimalIdentity.removeAnimal, { ownerUsername, animal: animalId }, { error }],
        [Requesting.respond, {
            request,
            status: error ? 400 : 200,
            body: error ? { error } : { message: `Animal '${animalId}' removed successfully.` },
        }],
    ),
});


// --- Get Single Animal Details Request Flow ---
export const GetSingleAnimalForUserRequest: Sync = (
    { request, session, animalId, ownerUsername, animal, error }, // Renamed userId to ownerUsername
) => ({
    when: actions(
        [Requesting.request, { path: `/animals/${animalId}`, method: "GET", session }, { request }],
    ),
    where: async (frames) => {
        const originalFrame = frames[0];
        frames = await authenticateAndGetUsername(frames, session, ownerUsername);
        if (frames.length === 0) {
            return new Frames({ ...originalFrame, [error]: "Authentication required or invalid session." });
        }
        // Query AnimalIdentity for the specific animal
        frames = await frames.query(AnimalIdentity._getAnimal, { ownerUsername, id: animalId }, { animal });

        if (frames.length === 0) {
            // Animal not found for this user, or query failed
            return new Frames({ ...originalFrame, [error]: `Animal with ID '${animalId}' not found for user '${ownerUsername}'.` });
        }
        return frames;
    },
    then: actions(
        [Requesting.respond, {
            request,
            status: error ? 404 : 200, // 404 if animal not found / error occurred
            body: error ? { error } : { animal },
        }],
    ),
});


// --- Get All Animals for User Request Flow ---
export const GetAllAnimalsForUserRequest: Sync = (
    { request, session, ownerUsername, animals, error }, // Renamed userId to ownerUsername
) => ({
    when: actions(
        [Requesting.request, { path: "/animals", method: "GET", session }, { request }],
    ),
    where: async (frames) => {
        const originalFrame = frames[0];
        frames = await authenticateAndGetUsername(frames, session, ownerUsername);
        if (frames.length === 0) {
            return new Frames({ ...originalFrame, [error]: "Authentication required or invalid session." });
        }
        // Query AnimalIdentity for all animals owned by this user
        frames = await frames.query(AnimalIdentity._getAllAnimals, { ownerUsername }, { animals });

        // If no animals are found, the query will return an empty array, which is fine.
        // We still want to respond with an empty array rather than an error.
        return frames;
    },
    then: actions(
        [Requesting.respond, {
            request,
            status: error ? 500 : 200, // 500 for generic query error
            body: error ? { error: `Failed to retrieve animals: ${error}` } : { animals: animals ?? [] }, // Ensure animals is an array
        }],
    ),
});
```
