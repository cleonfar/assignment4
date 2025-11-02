import { actions, Sync } from "@engine";
import { AnimalIdentity, Requesting, UserAuthentification } from "@concepts";
import { ID } from "@utils/types.ts";

// --- AnimalIdentity Specific Syncs ---

// Sync for handling animal registration request
export const AnimalRegisterRequest: Sync = (
  {
    request,
    session,
    authenticatedUser,
    id,
    species,
    sex,
    birthDate,
    breed,
    notes,
  },
) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/animals/register",
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
    // Directly verify the session token and bind the username to 'authenticatedUser'.
    // If verification fails, this 'when' clause won't match, and UnauthorizedRequest will handle it.
    [UserAuthentification.verify, { token: session }, {
      user: authenticatedUser,
    }],
  ),
  then: actions(
    // Pass 'authenticatedUser' (which is the username) to AnimalIdentity's 'user' parameter.
    [
      AnimalIdentity.registerAnimal,
      { user: authenticatedUser, id, species, sex, birthDate, breed, notes },
    ],
  ),
});

// Sync for responding to successful animal registration
export const AnimalRegisterResponse: Sync = ({ request, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/register" }, { request }],
    [AnimalIdentity.registerAnimal, {}, { animal }],
  ),
  then: actions(
    [Requesting.respond, { request, animal }],
  ),
});

// Sync for responding to failed animal registration
export const AnimalRegisterErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/register" }, { request }],
    [AnimalIdentity.registerAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling animal status update request
export const AnimalUpdateStatusRequest: Sync = (
  { request, session, authenticatedUser, animal, status, notes },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/animals/updateStatus", session, animal, status, notes },
      { request },
    ],
    [UserAuthentification.verify, { token: session }, {
      user: authenticatedUser,
    }],
  ),
  then: actions(
    [AnimalIdentity.updateStatus, {
      user: authenticatedUser,
      animal,
      status,
      notes,
    }],
  ),
});

// Sync for responding to successful animal status update
export const AnimalUpdateStatusResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/updateStatus" }, { request }],
    [AnimalIdentity.updateStatus, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal status updated successfully.",
    }],
  ),
});

// Sync for responding to failed animal status update
export const AnimalUpdateStatusErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/updateStatus" }, { request }],
    [AnimalIdentity.updateStatus, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling animal details edit request
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
  when: actions(
    [
      Requesting.request,
      {
        path: "/animals/editDetails",
        session,
        animal,
        species,
        breed,
        birthDate,
        sex,
      },
      { request },
    ],
    [UserAuthentification.verify, { token: session }, {
      user: authenticatedUser,
    }],
  ),
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

// Sync for responding to successful animal details edit
export const AnimalEditDetailsResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/editDetails" }, { request }],
    [AnimalIdentity.editDetails, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal details updated successfully.",
    }],
  ),
});

// Sync for responding to failed animal details edit
export const AnimalEditDetailsErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/editDetails" }, { request }],
    [AnimalIdentity.editDetails, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling animal mark as transferred request
export const AnimalMarkAsTransferredRequest: Sync = (
  { request, session, authenticatedUser, animal, date, recipientNotes },
) => ({
  when: actions(
    [
      Requesting.request,
      {
        path: "/animals/markTransferred",
        session,
        animal,
        date,
        recipientNotes,
      },
      { request },
    ],
    [UserAuthentification.verify, { token: session }, {
      user: authenticatedUser,
    }],
  ),
  then: actions(
    [
      AnimalIdentity.markAsTransferred,
      { user: authenticatedUser, animal, date, recipientNotes },
    ],
  ),
});

// Sync for responding to successful animal mark as transferred
export const AnimalMarkAsTransferredResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/markTransferred" }, { request }],
    [AnimalIdentity.markAsTransferred, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal marked as transferred successfully.",
    }],
  ),
});

// Sync for responding to failed animal mark as transferred
export const AnimalMarkAsTransferredErrorResponse: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals/markTransferred" }, { request }],
    [AnimalIdentity.markAsTransferred, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling animal mark as deceased request
export const AnimalMarkAsDeceasedRequest: Sync = (
  { request, session, authenticatedUser, animal, date, cause },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/animals/markDeceased", session, animal, date, cause },
      { request },
    ],
    [UserAuthentification.verify, { token: session }, {
      user: authenticatedUser,
    }],
  ),
  then: actions(
    [AnimalIdentity.markAsDeceased, {
      user: authenticatedUser,
      animal,
      date,
      cause,
    }],
  ),
});

// Sync for responding to successful animal mark as deceased
export const AnimalMarkAsDeceasedResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/markDeceased" }, { request }],
    [AnimalIdentity.markAsDeceased, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal marked as deceased successfully.",
    }],
  ),
});

// Sync for responding to failed animal mark as deceased
export const AnimalMarkAsDeceasedErrorResponse: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals/markDeceased" }, { request }],
    [AnimalIdentity.markAsDeceased, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling animal mark as sold request
export const AnimalMarkAsSoldRequest: Sync = (
  { request, session, authenticatedUser, animal, date, buyerNotes },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/animals/markSold", session, animal, date, buyerNotes },
      { request },
    ],
    [UserAuthentification.verify, { token: session }, {
      user: authenticatedUser,
    }],
  ),
  then: actions(
    [AnimalIdentity.markAsSold, {
      user: authenticatedUser,
      animal,
      date,
      buyerNotes,
    }],
  ),
});

// Sync for responding to successful animal mark as sold
export const AnimalMarkAsSoldResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/markSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, {
      request,
      message: "Animal marked as sold successfully.",
    }],
  ),
});

// Sync for responding to failed animal mark as sold
export const AnimalMarkAsSoldErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/markSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling animal removal request
export const AnimalRemoveRequest: Sync = (
  { request, session, authenticatedUser, animal },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals/remove", session, animal }, {
      request,
    }],
    [UserAuthentification.verify, { token: session }, {
      user: authenticatedUser,
    }],
  ),
  then: actions(
    [AnimalIdentity.removeAnimal, { user: authenticatedUser, animal }],
  ),
});

// Sync for responding to successful animal removal
export const AnimalRemoveResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/remove" }, { request }],
    [AnimalIdentity.removeAnimal, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, { request, message: "Animal removed successfully." }],
  ),
});

// Sync for responding to failed animal removal
export const AnimalRemoveErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/remove" }, { request }],
    [AnimalIdentity.removeAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for handling query for a single animal by ID
export const GetAnimalRequest: Sync = (
  { request, session, authenticatedUser, id, animalDoc, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals/get", session, id }, { request }],
    [UserAuthentification.verify, { token: session }, {
      user: authenticatedUser,
    }],
  ),
  where: async (frames) => {
    // Query for the animal, passing authenticatedUser (username) as the owner
    // AnimalIdentity._getAnimal returns { animal: AnimalDocument } or { error: string }
    const queried = await frames.query(
      async ({ user, id }: { user: string; id: string }) => {
        const res = await AnimalIdentity._getAnimal({
          user: user as ID,
          id: id as ID,
        });
        return [res];
      },
      { user: authenticatedUser, id },
      { animal: animalDoc, error },
    );
    return queried;
  },
  then: actions(),
});

// Sync for responding to errors when getting a single animal
export const GetAnimalErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/get" }, { request }],
  ),
  where: (frames) => frames.filter(($) => $[error] !== undefined),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for responding to successful get animal
export const GetAnimalSuccessResponse: Sync = ({ request, animalDoc }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/get" }, { request }],
  ),
  where: (frames) => frames.filter(($) => $[animalDoc] !== undefined),
  then: actions(
    [Requesting.respond, { request, animal: animalDoc }],
  ),
});

// Sync for handling query for all animals by user
export const GetAllAnimalsRequest: Sync = (
  { request, session, authenticatedUser, results, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals/all", session }, { request }],
    [UserAuthentification.verify, { token: session }, {
      user: authenticatedUser,
    }],
  ),
  where: async (frames) => {
    // Query for all animals owned by the authenticated user.
    // AnimalIdentity._getAllAnimals returns { animals: AnimalDocument[] } or { error: string }
    const queried = await frames.query(
      async ({ user }: { user: string }) => {
        const res = await AnimalIdentity._getAllAnimals({ user: user as ID });
        return [res];
      },
      { user: authenticatedUser },
      { animals: results, error },
    );
    return queried;
  },
  then: actions(),
});

// Sync for responding to errors when getting all animals
export const GetAllAnimalsErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/all" }, { request }],
  ),
  where: (frames) => frames.filter(($) => $[error] !== undefined),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for responding to successful get all animals
export const GetAllAnimalsSuccessResponse: Sync = ({ request, results }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/all" }, { request }],
  ),
  where: (frames) => frames.filter(($) => $[results] !== undefined),
  then: actions(
    [Requesting.respond, { request, results }],
  ),
});
