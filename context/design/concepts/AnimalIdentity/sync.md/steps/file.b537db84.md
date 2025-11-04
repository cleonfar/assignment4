---
timestamp: 'Sun Nov 02 2025 01:37:26 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251102_013726.47a6a5a9.md]]'
content_id: b537db84d5d77a01d84cbd0a3703eb90562da0ecb28a63e9a02eb74d6e6cc710
---

# file: src/concepts/UserAuthentication/UserAuthenticationConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { ID, Empty } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix using the concept name
const PREFIX = "UserAuthentication" + ".";

// Generic type parameter 'User' for this concept
type User = ID;
// Type for session tokens, also treated as an ID
type SessionToken = ID;

/**
 * Interface representing a User document in the database.
 * Corresponds to "a set of Users with a username String, a password String" in the state.
 */
interface UserDoc {
  _id: User; // The unique identifier for the user
  username: string;
  password: string;
}

/**
 * Interface representing an active session document in the database.
 * Corresponds to "a set of activeSessions with a session token String, a username String" in the state.
 */
interface SessionDoc {
  _id: SessionToken; // The session token itself acts as the document's ID
  username: string; // The username associated with this active session
}

/**
 * **concept** UserAuthentication [User]
 *
 * **purpose** Verify a user's identity to grant or deny access to a web account.
 *
 * **principle** If a user registers with a unique username and a password, and subsequently attempts to
 * log in with those same credentials, they will be successfully authenticated as that user,
 * enabling access to their account.
 */
export default class UserAuthenticationConcept {
  private users: Collection<UserDoc>;
  private activeSessions: Collection<SessionDoc>;

  constructor(private readonly db: Db) {
    this.users = this.db.collection(PREFIX + "users");
    this.activeSessions = this.db.collection(PREFIX + "activeSessions");
  }

  /**
   * register (username: String, password: String): (user: User)
   * register (username: String, password: String): (error: String)
   *
   * **requires** there is no User 'u' in the set of Users whose username is 'username'
   *
   * **effects**
   *   create a new User entity
   *   associate 'username' with this new User
   *   associate 'password' with this new User
   *   returns the new User entity (its ID)
   */
  async register(
    { username, password }: { username: string; password: string },
  ): Promise<{ user: User } | { error: string }> {
    // Check precondition: no User with the given username already exists
    const existingUser = await this.users.findOne({ username });
    if (existingUser) {
      return { error: `Username '${username}' already exists.` };
    }

    // Effects: Create a new User entity and associate username/password
    const newUser: UserDoc = {
      _id: freshID() as User, // Generate a unique ID for the new user
      username,
      password,
    };

    try {
      await this.users.insertOne(newUser);
      // Returns the ID of the new User entity
      return { user: newUser._id };
    } catch (e) {
      console.error("Error registering user:", e);
      return { error: "Failed to register user due to a database error." };
    }
  }

  /**
   * login (username: String, password: String): (user: String)
   * login (username: String, password: String): (error: String)
   *
   * **requires**
   *   there exists a User 'u' such that u's username is 'username' AND u's password is 'password'
   *
   * **effects**
   *   If authentication is successful, creates a new active session for the user
   *   returns the user's username
   */
  async login(
    { username, password }: { username: string; password: string },
  ): Promise<{ token: string } | { error: string }> {
    // Check precondition: user with matching username and password exists
    const user = await this.users.findOne({ username, password });
    if (!user) {
      return { error: "Invalid username or password." };
    }

    // Effects: Create a new active session for the authenticated user
    const sessionToken = freshID() as SessionToken; // Generate a unique session token
    const newSession: SessionDoc = {
      _id: sessionToken,
      username: user.username,
    };

    try {
      await this.activeSessions.insertOne(newSession);
      // Returns the user's username (as specified in the concept)
      return { token: newSession._id };
    } catch (e) {
      console.error("Error creating session for login:", e);
      return { error: "Failed to log in due to a database error." };
    }
  }

  /**
   * verify (token: String): (user: String)
   * verify (token: String): (error: String)
   *
   * **requires** the session token is in the set of activeSessions
   *
   * **effects** returns the username associated with the session
   */
  async verify(
    { token }: { token: string },
  ): Promise<{ user: string } | { error: string }> {
    // Check precondition: the session token is in the set of activeSessions
    const session = await this.activeSessions.findOne({ _id: token as SessionToken });
    if (!session) {
      return { error: "Invalid or expired session token." };
    }

    // Effects: returns the username associated with the session
    return { user: session.username };
  }

  /**
   * logout (token: String): Empty
   * logout (token: String): (error: String)
   *
   * This action is a logical addition to a UserAuthentication concept,
   * though not explicitly present in the provided specification.
   *
   * **requires** the session token is in the set of activeSessions
   *
   * **effects** removes the session token from activeSessions
   */
  async logout(
    { token }: { token: string },
  ): Promise<Empty | { error: string }> {
    const result = await this.activeSessions.deleteOne({ _id: token as SessionToken });
    if (result.deletedCount === 0) {
      return { error: "Session token not found or already logged out." };
    }
    return {};
  }
}
```

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
```

```typescript
import { actions, Sync } from "@engine";
import { AnimalIdentity, Requesting, UserAuthentication } from "@concepts"; // Corrected import
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
