---
timestamp: 'Sun Nov 02 2025 01:05:17 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251102_010517.1563a92e.md]]'
content_id: 2f6932cf473aca3b64dfe9fbc8bda626a3f661b637f9eb11a15843cffa98f79b
---

# file: src/syncs/auth.sync.ts (Updated)

```typescript
import { actions, Frames, Sync } from "@engine";
// Corrected import: UserAuthentication
import { AnimalIdentity, Requesting, UserAuthentication } from "@concepts";
import { ID } from "@utils/types.ts";

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
    // Directly verify the session token and bind the username to 'authenticatedUser'.
    [UserAuthentication.verify, { token: session }, { // Corrected concept name
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
    [Requesting.request, { path: "/AnimalIdentity/registerAnimal" }, {
      request,
    }],
    [AnimalIdentity.registerAnimal, {}, { animal }],
  ),
  then: actions(
    [Requesting.respond, { request, animal }],
  ),
});

// Sync for responding to failed animal registration
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

// Sync for handling animal status update request
export const AnimalUpdateStatusRequest: Sync = (
  { request, session, authenticatedUser, animal, status, notes },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/updateStatus", session, animal, status, notes },
      { request },
    ],
    [UserAuthentication.verify, { token: session }, { // Corrected concept name
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

// Sync for responding to failed animal status update
export const AnimalUpdateStatusErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/updateStatus" }, { request }],
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
    [UserAuthentication.verify, { token: session }, { // Corrected concept name
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

// Sync for responding to failed animal details edit
export const AnimalEditDetailsErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/editDetails" }, { request }],
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
        path: "/AnimalIdentity/markAsTransferred",
        session,
        animal,
        date,
        recipientNotes,
      },
      { request },
    ],
    [UserAuthentication.verify, { token: session }, { // Corrected concept name
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

// Sync for responding to failed animal mark as transferred
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

// Sync for handling animal mark as deceased request
export const AnimalMarkAsDeceasedRequest: Sync = (
  { request, session, authenticatedUser, animal, date, cause },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/markAsDeceased", session, animal, date, cause },
      { request },
    ],
    [UserAuthentication.verify, { token: session }, { // Corrected concept name
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

// Sync for responding to failed animal mark as deceased
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

// Sync for handling animal mark as sold request
export const AnimalMarkAsSoldRequest: Sync = (
  { request, session, authenticatedUser, animal, date, buyerNotes },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/AnimalIdentity/markAsSold", session, animal, date, buyerNotes },
      { request },
    ],
    [UserAuthentication.verify, { token: session }, { // Corrected concept name
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

// Sync for responding to failed animal mark as sold
export const AnimalMarkAsSoldErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsSold" }, { request }],
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
    [Requesting.request, {
      path: "/AnimalIdentity/removeAnimal",
      session,
      animal,
    }, {
      request,
    }],
    [UserAuthentication.verify, { token: session }, { // Corrected concept name
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
    [Requesting.request, { path: "/AnimalIdentity/removeAnimal" }, { request }],
    [AnimalIdentity.removeAnimal, {}, {}], // Empty result
  ),
  then: actions(
    [Requesting.respond, { request, message: "Animal removed successfully." }],
  ),
});

// Sync for responding to failed animal removal
export const AnimalRemoveErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/removeAnimal" }, { request }],
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
    [Requesting.request, { path: "/AnimalIdentity/_getAnimal", session, id }, {
      request,
    }],
    [UserAuthentication.verify, { token: session }, { // Corrected concept name
      user: authenticatedUser,
    }],
  ),
  where: async (frames) => {
    // Query for the animal, passing authenticatedUser (username) as the owner
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
    [Requesting.request, { path: "/AnimalIdentity/_getAnimal" }, { request }],
  ),
  where: (frames) => frames.filter(($) => $[error] !== undefined),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for responding to successful animal get
export const GetAnimalSuccessResponse: Sync = ({ request, animalDoc }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAnimal" }, { request }],
  ),
  where: (frames) => frames.filter(($) => $[animalDoc] !== undefined),
  then: actions(
    [Requesting.respond, { request, animal: animalDoc }],
  ),
});

// Sync for handling query for all AnimalIdentity by user
export const GetAllAnimalsRequest: Sync = (
  { request, session, authenticatedUser, results, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAllAnimals", session }, {
      request,
    }],
    [UserAuthentication.verify, { token: session }, { // Corrected concept name
      user: authenticatedUser,
    }],
  ),
  where: async (frames) => {
    // Query for all AnimalIdentity owned by the authenticated user.
    const queried = await frames.query(
      async ({ user }: { user: string }) => {
        const res = await AnimalIdentity._getAllAnimals({ user: user as ID });
        return [res];
      },
      { user: authenticatedUser },
      { AnimalIdentity: results, error },
    );
    return queried;
  },
  then: actions(),
});

// Sync for responding to errors when getting all AnimalIdentity
export const GetAllAnimalsErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAllAnimals" }, {
      request,
    }],
  ),
  where: (frames) => frames.filter(($) => $[error] !== undefined),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync for responding to successful get all AnimalIdentity
export const GetAllAnimalsSuccessResponse: Sync = ({ request, results }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/_getAllAnimals" }, {
      request,
    }],
  ),
  where: (frames) => frames.filter(($) => $[results] !== undefined),
  then: actions(
    [Requesting.respond, { request, results }],
  ),
});
```

**Crucial Next Steps:**

1. **Rename the Concept Folder:** You *must* rename the folder `src/concepts/UserAuthentification` to `src/concepts/UserAuthentication`.
2. **Rename the Concept File:** You *must* rename the file `src/concepts/UserAuthentification/UserAuthentificationConcept.ts` to `src/concepts/UserAuthentication/UserAuthenticationConcept.ts`.
3. **Update the Concept Implementation:** Ensure the `UserAuthenticationConcept.ts` file itself has the correct class name `UserAuthenticationConcept` and reflects the new folder/file name in its `import` and `export` paths if they were absolute or relative to a parent. (The provided code for `UserAuthenticationConcept.ts` already uses the correct spelling, so no changes are needed there *if* it was originally saved with that spelling).
4. **Rebuild Imports:** Run `deno run build` again to ensure the `@concepts` alias file `src/concepts/concepts.ts` is updated with the correct spelling and path.
5. **Restart Server:** After all these changes, restart your Deno server (`deno run start`).

These steps are critical for Deno to correctly resolve the module path and for the `@concepts` alias to work. If you skip steps 1, 2, or 4, you'll likely run into similar timeout errors because the engine won't be able to find the `UserAuthentication` concept.
