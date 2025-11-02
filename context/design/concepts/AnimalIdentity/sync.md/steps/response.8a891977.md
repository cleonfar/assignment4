---
timestamp: 'Sat Nov 01 2025 22:46:49 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251101_224649.108ddbc3.md]]'
content_id: 8a891977abd87a11b91e6b23a81298133a8eba2b016c68b4bd184d2b979d0ddd
---

# response:

Okay, this is a very insightful clarification! By stating that the `userID` for `AnimalIdentity` is effectively the `username` from `UserAuthentication`, we're making a strong statement about the identity mapping between these two concepts.

This change requires three key updates:

1. **Modify `UserAuthenticationConcept`**: Add a query `_getUsernameById` to bridge the `User` ID returned by `register` to the `username` string, which is what `AnimalIdentity` expects.
2. **Update `AnimalIdentityConcept`**: Adjust documentation for the `User` type parameter to clarify it expects a `username` string. The implementation can remain largely the same, but the MongoDB unique index needs to correctly reflect the composite key of `(_id, owner)` where `owner` is the username.
3. **Create Synchronizations**: Define the `syncs` to orchestrate calls between `Requesting`, `UserAuthentication`, and `AnimalIdentity`, ensuring the `username` is passed consistently.

Let's proceed with these steps.

***

### 1. Update `UserAuthentication` Concept Specification and Implementation

We need to add a query to `UserAuthentication` to get the `username` when we only have the internal `User` ID (e.g., after `register` returns an `ID`).

#### **concept** UserAuthentication (Query Added)

* (rest of concept spec is the same)
* **queries**
  * `_getUsernameById (userId: User): (username: String)`
    * **requires** userId exists in Users
    * **effects** returns the username associated with userId

#### **file: src/concepts/UserAuthentication/UserAuthenticationConcept.ts (Update)**

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
  _id: User; // The unique identifier for the user (an internal ID)
  username: string; // The user's chosen username (which will be the ID for AnimalIdentity)
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
    // Ensure usernames are unique
    this.users.createIndex({ username: 1 }, { unique: true });
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
   *   returns the new User entity (its internal ID)
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
      _id: freshID() as User, // Generate a unique internal ID for the new user
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
   * login (username: String, password: String): (token: String)
   * login (username: String, password: String): (error: String)
   *
   * **requires**
   *   there exists a User 'u' such that u's username is 'username' AND u's password is 'password'
   *
   * **effects**
   *   If authentication is successful, creates a new active session for the user
   *   returns the session token
   */
  async login(
    { username, password }: { username: string; password: string },
  ): Promise<{ token: SessionToken } | { error: string }> {
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
      // Returns the session token
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
    { token }: { token: SessionToken },
  ): Promise<{ user: string } | { error: string }> { // 'user' is the username string here
    // Check precondition: the session token is in the set of activeSessions
    const session = await this.activeSessions.findOne({ _id: token });
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
   * **requires** the session token is in the set of activeSessions
   *
   * **effects** removes the session token from activeSessions
   */
  async logout(
    { token }: { token: SessionToken },
  ): Promise<Empty | { error: string }> {
    const result = await this.activeSessions.deleteOne({ _id: token });
    if (result.deletedCount === 0) {
      return { error: "Session token not found or already logged out." };
    }
    return {};
  }

  // --- Concept Queries ---

  /**
   * _getUsernameById (userId: User): (username: String)
   * @requires userId exists in Users
   * @effects returns the username associated with userId
   */
  async _getUsernameById(
    { userId }: { userId: User },
  ): Promise<{ username: string } | { error: string }> {
    try {
      const userDoc = await this.users.findOne({ _id: userId });
      if (!userDoc) {
        return { error: `User with ID '${userId}' not found.` };
      }
      return { username: userDoc.username };
    } catch (e) {
      console.error("Error fetching username by user ID:", e);
      return { error: "Failed to fetch username due to a database error." };
    }
  }
}
```

***

### 2. Update `AnimalIdentity` Concept Specification and Implementation

We need to make sure `AnimalIdentity` explicitly handles the `user` parameter (which is the username string) and allows duplicate animal IDs if the user (owner) is different.

#### **concept** AnimalIdentity (Updated for User Context)

* **purpose** allow users to represent and manage their individual animals with persistent identifiers and core attributes

* **principle**
  a user registers animals to track them individually across their lifecycle;
  assigns each animal a unique tag and records identifying details;
  updates status to reflect key transitions such as sale, death, or transfer;

* **state**
  * a set of `Animals` with
    * an `id` tag of type `ID` (unique per user)
    * an `owner` of type `String` (referencing the username of the user who registered the animal)
    * a `species` of type `String`
    * an optional `breed` of type `String`
    * a `sex` of type `Enum [male, female, neutered]`
    * a `status` of type `Enum [alive, sold, deceased, transferred]`
    * an optional `notes` of type `String`
    * an optional `birthDate` of type `Date`

* **actions**
  * `registerAnimal (user: String, id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, notes?: String): (animal: Animal)`
    * **requires** No animal with this `id` is registered by this `user`
    * **effects** create a new animal owned by `user` with given attributes, status set to alive; returns the animal's ID

  * `updateStatus (user: String, animal: Animal, status: Enum, notes: String): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists
    * **effects** set the animal’s status to the new value and record optional notes

  * `editDetails (user: String, animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists
    * **effects** update the animal’s identifying attributes

  * `markAsTransferred (user: String, animal: AnimalID, date: Date, recipientNotes?: String): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists, animal's status is alive
    * **effects** sets the animal’s status to 'transferred', and records the date and recipient notes in notes.

  * `markAsDeceased (user: String, animal: AnimalID, date: Date, cause?: String): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists, animal's status is alive
    * **effects** sets the animal’s status to 'deceased', and records the date and cause in notes.

  * `markAsSold (user: String, animal: AnimalID, date: Date, buyerNotes?: String): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists, animal's status is alive
    * **effects** sets the animal’s status to 'sold', and records the date and buyer notes in notes.

  * `removeAnimal (user: String, animal: AnimalID): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists
    * **effects** removes the animal from the set of Animals

* **queries**
  * `_getAnimal (user: String, id: ID): (animal: AnimalDocument)`
    * **requires** an animal with `id` owned by `user` exists
    * **effects** returns the animal document for the given ID and user

  * `_getAllAnimals (user: String): (animals: AnimalDocument[])`
    * **requires** true
    * **effects** returns a list of all animal documents owned by the `user`

#### **file: src/AnimalIdentity/AnimalIdentityConcept.ts (Updated with User Scope)**

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";

// Declare collection prefix, use concept name
const PREFIX = "AnimalIdentity" + ".";

// Generic types of this concept (Animal is an ID, User is now explicitly a string for username)
type Animal = ID;
type User = string; // Explicitly defining User as a string (username)

/**
 * Sex of an animal.
 */
type Sex = "male" | "female" | "neutered";

/**
 * Status of an animal.
 */
type AnimalStatus = "alive" | "sold" | "deceased" | "transferred";

/**
 * @concept AnimalIdentity
 * @purpose allow users to represent and manage their individual animals with persistent identifiers and core attributes
 *
 * @principle a user registers animals to track them individually across their lifecycle;
 *   assigns each animal a unique tag and records identifying details;
 *   updates status to reflect key transitions such as sale, death, or transfer;
 *
 * @state
 *   a set of `Animals` with
 *     an `id` tag of type `ID` (unique per user)
 *     an `owner` of type `String` (referencing the username of the user who registered the animal)
 *     a `species` of type `String`
 *     an optional `breed` of type `String`
 *     a `sex` of type `Enum [male, female, neutered]`
 *     a `status` of type `Enum [alive, sold, deceased, transferred]`
 *     an optional `notes` of type `String`
 *     an optional `birthDate` of type `Date`
 */
interface AnimalDocument {
  _id: ID; // The animal's ID (unique per user/owner)
  owner: User; // The username of the user who registered this animal
  species: string;
  breed: string; // Using "" for optional string fields if not provided
  sex: Sex;
  status: AnimalStatus;
  notes: string; // Using "" for optional string fields if not provided
  birthDate: Date | null; // Using null for optional Date fields if not provided
}

export default class AnimalIdentityConcept {
  private animals: Collection<AnimalDocument>;

  constructor(private readonly db: Db) {
    this.animals = this.db.collection(PREFIX + "animals");
    // Ensure a unique index on the composite key of (_id, owner)
    // This allows duplicate animal IDs as long as the owner (username) is different.
    this.animals.createIndex({ _id: 1, owner: 1 }, { unique: true });
  }

  /**
   * registerAnimal (user: String, id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, notes?: String): (animal: Animal)
   * @requires No animal with this `id` is registered by this `user`
   * @effects create a new animal owned by `user` with given attributes, status set to alive; returns the animal's ID
   */
  async registerAnimal(
    {
      user, // User is the username string
      id,
      species,
      sex,
      birthDate,
      breed,
      notes,
    }: {
      user: User; // User is the username string
      id: ID;
      species: string;
      sex: Sex;
      birthDate?: Date;
      breed?: string;
      notes?: string;
    },
  ): Promise<{ animal: Animal } | { error: string }> {
    // Precondition: No animal with this ID is registered by this user
    const existingAnimal = await this.animals.findOne({ _id: id, owner: user });
    if (existingAnimal) {
      return { error: `Animal with ID '${id}' already exists for user '${user}'.` };
    }

    const newAnimal: AnimalDocument = {
      _id: id,
      owner: user, // Associate animal with the registering username
      species: species,
      breed: breed ?? "",
      sex: sex,
      status: "alive",
      notes: notes ?? "",
      birthDate: birthDate ?? null,
    };

    try {
      await this.animals.insertOne(newAnimal);
      return { animal: newAnimal._id };
    } catch (e) {
      console.error("Error registering animal:", e);
      return { error: "Failed to register animal due to a database error." };
    }
  }

  /**
   * updateStatus (user: String, animal: Animal, status: Enum, notes: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists
   * @effects set the animal’s status to the new value and record optional notes
   */
  async updateStatus(
    { user, animal, status, notes }: { user: User; animal: Animal; status: AnimalStatus; notes: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `user` exists
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }

    try {
      const result = await this.animals.updateOne(
        { _id: animal, owner: user },
        { $set: { status: status, notes: notes } },
      );
      if (result.matchedCount === 0) {
        return { error: `Failed to update status for animal '${animal}' for user '${user}'.` };
      }
      return {};
    } catch (e) {
      console.error("Error updating animal status:", e);
      return { error: "Failed to update animal status due to a database error." };
    }
  }

  /**
   * editDetails (user: String, animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum): Empty
   * @requires an animal with `animal` ID owned by `user` exists
   * @effects update the animal’s identifying attributes
   */
  async editDetails(
    { user, animal, species, breed, birthDate, sex }: {
      user: User; // User is the username string
      animal: Animal;
      species: string;
      breed: string;
      birthDate: Date;
      sex: Sex;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `user` exists
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }

    try {
      const result = await this.animals.updateOne(
        { _id: animal, owner: user },
        { $set: { species, breed, birthDate, sex } },
      );
      if (result.matchedCount === 0) {
        return { error: `Failed to edit details for animal '${animal}' for user '${user}'.` };
      }
      return {};
    } catch (e) {
      console.error("Error editing animal details:", e);
      return { error: "Failed to edit animal details due to a database error." };
    }
  }

  /**
   * markAsTransferred (user: String, animal: AnimalID, date: Date, recipientNotes?: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists, animal's status is alive
   * @effects sets the animal’s status to 'transferred', and records the date and recipient notes in notes.
   */
  async markAsTransferred(
    { user, animal, date, recipientNotes }: { user: User; animal: Animal; date: Date; recipientNotes?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' for user '${user}' must be 'alive' to be marked as transferred (current status: ${existingAnimal.status}).` };
    }

    const notes = `Transferred on ${date.toISOString().split("T")[0]}. Recipient notes: ${recipientNotes ?? "None"}.`;
    return this.updateStatus({ user, animal, status: "transferred", notes });
  }

  /**
   * markAsDeceased (user: String, animal: AnimalID, date: Date, cause?: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists, animal's status is alive
   * @effects sets the animal’s status to 'deceased', and records the date and cause in notes.
   */
  async markAsDeceased(
    { user, animal, date, cause }: { user: User; animal: Animal; date: Date; cause?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' for user '${user}' must be 'alive' to be marked as deceased (current status: ${existingAnimal.status}).` };
    }

    const notes = `Deceased on ${date.toISOString().split("T")[0]}. Cause: ${cause ?? "unspecified"}.`;
    return this.updateStatus({ user, animal, status: "deceased", notes });
  }

  /**
   * markAsSold (user: String, animal: AnimalID, date: Date, buyerNotes?: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists, animal's status is alive
   * @effects sets the animal’s status to 'sold', and records the date and buyer notes in notes.
   */
  async markAsSold(
    { user, animal, date, buyerNotes }: { user: User; animal: Animal; date: Date; buyerNotes?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' for user '${user}' must be 'alive' to be marked as sold (current status: ${existingAnimal.status}).` };
    }

    const notes = `Sold on ${date.toISOString().split("T")[0]}. Buyer notes: ${buyerNotes ?? "None"}.`;
    return this.updateStatus({ user, animal, status: "sold", notes });
  }

  /**
   * removeAnimal (user: String, animal: AnimalID): Empty
   * @requires an animal with `animal` ID owned by `user` exists
   * @effects removes the animal from the set of Animals
   */
  async removeAnimal(
    { user, animal }: { user: User; animal: Animal },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `user` exists
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }

    try {
      const result = await this.animals.deleteOne({ _id: animal, owner: user });
      if (result.deletedCount === 0) {
        return { error: `Failed to remove animal '${animal}' for user '${user}'. It may no longer exist.` };
      }
      return {};
    } catch (e) {
      console.error("Error removing animal:", e);
      return { error: "Failed to remove animal due to a database error." };
    }
  }

  // --- Concept Queries ---

  /**
   * _getAnimal (user: String, id: ID): (animal: AnimalDocument)
   * @requires an animal with `id` owned by `user` exists
   * @effects returns the animal document for the given ID and user
   */
  async _getAnimal(
    { user, id }: { user: User; id: ID },
  ): Promise<{ animal?: AnimalDocument } | { error: string }> {
    try {
      const animal = await this.animals.findOne({ _id: id, owner: user });
      if (!animal) {
        return { error: `Animal with ID '${id}' not found for user '${user}'.` };
      }
      return { animal };
    } catch (e) {
      console.error("Error fetching animal:", e);
      return { error: "Failed to fetch animal due to a database error." };
    }
  }

  /**
   * _getAllAnimals (user: String): (animals: AnimalDocument[])
   * @requires true
   * @effects returns a list of all animal documents owned by the `user`
   */
  async _getAllAnimals(
    { user }: { user: User },
  ): Promise<{ animals: AnimalDocument[] } | { error: string }> {
    try {
      const allAnimals = await this.animals.find({ owner: user }).toArray();
      return { animals: allAnimals };
    } catch (e) {
      console.error("Error fetching all animals for user:", e);
      return { error: "Failed to fetch all animals due to a database error." };
    }
  }
}
```

***

### 3. Synchronizations for `UserAuthentication` and `AnimalIdentity`

These synchronizations will define the API endpoints and orchestrate the flow:

* **Authentication**: Handling user registration, login, and logout.
* **Animal Management**: All `AnimalIdentity` actions and queries will be prefixed with authentication using `UserAuthentication.verify` to get the `username` from a session token.

**file: src/syncs/user\_animal\_management.sync.ts**

```typescript
import { actions, Frames, Sync } from "@engine";
import { Requesting, UserAuthentication, AnimalIdentity } from "@concepts"; // Assuming @concepts aggregates all

// Helper to handle authentication and get the username from a session token.
// Returns frames with 'user' bound to the username string if successful.
// If authentication fails, it returns empty frames.
const authenticateRequest = async (frames: Frames, sessionSymbol: symbol, userSymbol: symbol) => {
  return await frames.query(UserAuthentication.verify, { token: sessionSymbol }, { user: userSymbol });
};

// -------------------------------------------------------------
// USER AUTHENTICATION & REGISTRATION FLOWS
// These define the API for user management
// -------------------------------------------------------------

// Sync: Process a user registration request (HTTP POST to /user/register)
export const UserRegistrationRequest: Sync = (
  { request, username, password, user: userId }, // 'userId' is the internal ID from UserAuthentication
) => ({
  when: actions([
    Requesting.request,
    { path: "/user/register", username, password },
    { request },
  ]),
  then: actions([
    UserAuthentication.register,
    { username, password },
    { user: userId }, // UserAuthentication.register returns an internal ID
  ]),
});

// Sync: Respond to a successful user registration
export const UserRegistrationSuccessResponse: Sync = (
  { request, user: userId, username }, // 'username' will be derived from 'userId'
) => ({
  when: actions(
    [Requesting.request, { path: "/user/register" }, { request }], // Match the original request
    [UserAuthentication.register, {}, { user: userId }], // Match the successful registration action
  ),
  where: async (frames) => {
    // Get the username (string) from the internal userId (ID) for response
    return await frames.query(UserAuthentication._getUsernameById, { userId: userId }, { username });
  },
  then: actions(
    [Requesting.respond, { request, username }], // Respond with the username string
  ),
});

// Sync: Respond to a failed user registration
export const UserRegistrationErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/user/register" }, { request }],
    [UserAuthentication.register, {}, { error }], // Match the failed registration action
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync: Process a user login request (HTTP POST to /user/login)
export const UserLoginRequest: Sync = ({ request, username, password }) => ({
  when: actions([
    Requesting.request,
    { path: "/user/login", username, password },
    { request },
  ]),
  then: actions([
    UserAuthentication.login,
    { username, password },
  ]),
});

// Sync: Respond to a successful user login with a session token
export const UserLoginSuccessResponse: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/user/login" }, { request }],
    [UserAuthentication.login, {}, { token }], // UserAuthentication.login returns a session token
  ),
  then: actions(
    [Requesting.respond, { request, token }],
  ),
});

// Sync: Respond to a failed user login
export const UserLoginErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/user/login" }, { request }],
    [UserAuthentication.login, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// Sync: Process a user logout request (HTTP POST to /user/logout)
export const UserLogoutRequest: Sync = ({ request, token }) => ({
  when: actions([
    Requesting.request,
    { path: "/user/logout", token },
    { request },
  ]),
  then: actions([
    UserAuthentication.logout,
    { token },
  ]),
});

// Sync: Respond to a successful user logout
export const UserLogoutSuccessResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/user/logout" }, { request }],
    [UserAuthentication.logout, {}, {}], // Empty result for success
  ),
  then: actions(
    [Requesting.respond, { request, message: "Logged out successfully." }], // Custom success message
  ),
});

// Sync: Respond to a failed user logout
export const UserLogoutErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/user/logout" }, { request }],
    [UserAuthentication.logout, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});


// -------------------------------------------------------------
// ANIMAL IDENTITY MANAGEMENT FLOWS (AUTHENTICATED)
// Each request below follows a pattern:
// 1. A Requesting.request comes in, usually with a 'session' token.
// 2. The 'where' clause authenticates this session to get the 'user' (username string).
// 3. The 'then' clause calls the appropriate AnimalIdentity action/query, passing the 'user'.
// 4. Separate success/error syncs respond to the original Request.
// -------------------------------------------------------------

// REGISTER ANIMAL
export const RegisterAnimalRequest: Sync = (
  { request, session, id, species, sex, birthDate, breed, notes, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/animal/register", session, id, species, sex, birthDate, breed, notes },
    { request },
  ]),
  where: async (frames) => {
    // Authenticate the session and get the username, bound to 'user' symbol
    const authenticatedFrames = await authenticateRequest(frames, session, user);
    if (authenticatedFrames.length === 0) {
      // If authentication fails, produce a frame with an error for the next sync
      return new Frames({ ...frames[0], [request]: frames[0][request], error: "Authentication failed. Invalid session." });
    }
    return authenticatedFrames;
  },
  then: actions([
    AnimalIdentity.registerAnimal,
    { user, id, species, sex, birthDate, breed, notes },
  ]),
});

export const RegisterAnimalSuccessResponse: Sync = ({ request, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/register" }, { request }],
    [AnimalIdentity.registerAnimal, {}, { animal }],
  ),
  then: actions([Requesting.respond, { request, animal }]),
});

export const RegisterAnimalErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/register" }, { request }],
    [AnimalIdentity.registerAnimal, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});


// UPDATE ANIMAL STATUS
export const UpdateAnimalStatusRequest: Sync = (
  { request, session, animal, status, notes, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/animal/updateStatus", session, animal, status, notes },
    { request },
  ]),
  where: async (frames) => {
    const authenticatedFrames = await authenticateRequest(frames, session, user);
    if (authenticatedFrames.length === 0) {
      return new Frames({ ...frames[0], [request]: frames[0][request], error: "Authentication failed. Invalid session." });
    }
    return authenticatedFrames;
  },
  then: actions([
    AnimalIdentity.updateStatus,
    { user, animal, status, notes },
  ]),
});

export const UpdateAnimalStatusSuccessResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/updateStatus" }, { request }],
    [AnimalIdentity.updateStatus, {}, {}],
  ),
  then: actions([Requesting.respond, { request, message: "Animal status updated." }]),
});

export const UpdateAnimalStatusErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/updateStatus" }, { request }],
    [AnimalIdentity.updateStatus, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});


// EDIT ANIMAL DETAILS
export const EditAnimalDetailsRequest: Sync = (
  { request, session, animal, species, breed, birthDate, sex, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/animal/editDetails", session, animal, species, breed, birthDate, sex },
    { request },
  ]),
  where: async (frames) => {
    const authenticatedFrames = await authenticateRequest(frames, session, user);
    if (authenticatedFrames.length === 0) {
      return new Frames({ ...frames[0], [request]: frames[0][request], error: "Authentication failed. Invalid session." });
    }
    return authenticatedFrames;
  },
  then: actions([
    AnimalIdentity.editDetails,
    { user, animal, species, breed, birthDate, sex },
  ]),
});

export const EditAnimalDetailsSuccessResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/editDetails" }, { request }],
    [AnimalIdentity.editDetails, {}, {}],
  ),
  then: actions([Requesting.respond, { request, message: "Animal details updated." }]),
});

export const EditAnimalDetailsErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/editDetails" }, { request }],
    [AnimalIdentity.editDetails, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});


// MARK ANIMAL AS TRANSFERRED
export const MarkAnimalAsTransferredRequest: Sync = (
  { request, session, animal, date, recipientNotes, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/animal/markAsTransferred", session, animal, date, recipientNotes },
    { request },
  ]),
  where: async (frames) => {
    const authenticatedFrames = await authenticateRequest(frames, session, user);
    if (authenticatedFrames.length === 0) {
      return new Frames({ ...frames[0], [request]: frames[0][request], error: "Authentication failed. Invalid session." });
    }
    return authenticatedFrames;
  },
  then: actions([
    AnimalIdentity.markAsTransferred,
    { user, animal, date, recipientNotes },
  ]),
});

export const MarkAnimalAsTransferredSuccessResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/markAsTransferred" }, { request }],
    [AnimalIdentity.markAsTransferred, {}, {}],
  ),
  then: actions([Requesting.respond, { request, message: "Animal marked as transferred." }]),
});

export const MarkAnimalAsTransferredErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/markAsTransferred" }, { request }],
    [AnimalIdentity.markAsTransferred, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});


// MARK ANIMAL AS DECEASED
export const MarkAnimalAsDeceasedRequest: Sync = (
  { request, session, animal, date, cause, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/animal/markAsDeceased", session, animal, date, cause },
    { request },
  ]),
  where: async (frames) => {
    const authenticatedFrames = await authenticateRequest(frames, session, user);
    if (authenticatedFrames.length === 0) {
      return new Frames({ ...frames[0], [request]: frames[0][request], error: "Authentication failed. Invalid session." });
    }
    return authenticatedFrames;
  },
  then: actions([
    AnimalIdentity.markAsDeceased,
    { user, animal, date, cause },
  ]),
});

export const MarkAnimalAsDeceasedSuccessResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/markAsDeceased" }, { request }],
    [AnimalIdentity.markAsDeceased, {}, {}],
  ),
  then: actions([Requesting.respond, { request, message: "Animal marked as deceased." }]),
});

export const MarkAnimalAsDeceasedErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/markAsDeceased" }, { request }],
    [AnimalIdentity.markAsDeceased, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});


// MARK ANIMAL AS SOLD
export const MarkAnimalAsSoldRequest: Sync = (
  { request, session, animal, date, buyerNotes, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/animal/markAsSold", session, animal, date, buyerNotes },
    { request },
  ]),
  where: async (frames) => {
    const authenticatedFrames = await authenticateRequest(frames, session, user);
    if (authenticatedFrames.length === 0) {
      return new Frames({ ...frames[0], [request]: frames[0][request], error: "Authentication failed. Invalid session." });
    }
    return authenticatedFrames;
  },
  then: actions([
    AnimalIdentity.markAsSold,
    { user, animal, date, buyerNotes },
  ]),
});

export const MarkAnimalAsSoldSuccessResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/markAsSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, {}],
  ),
  then: actions([Requesting.respond, { request, message: "Animal marked as sold." }]),
});

export const MarkAnimalAsSoldErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/markAsSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});


// REMOVE ANIMAL
export const RemoveAnimalRequest: Sync = (
  { request, session, animal, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/animal/remove", session, animal },
    { request },
  ]),
  where: async (frames) => {
    const authenticatedFrames = await authenticateRequest(frames, session, user);
    if (authenticatedFrames.length === 0) {
      return new Frames({ ...frames[0], [request]: frames[0][request], error: "Authentication failed. Invalid session." });
    }
    return authenticatedFrames;
  },
  then: actions([
    AnimalIdentity.removeAnimal,
    { user, animal },
  ]),
});

export const RemoveAnimalSuccessResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/remove" }, { request }],
    [AnimalIdentity.removeAnimal, {}, {}],
  ),
  then: actions([Requesting.respond, { request, message: "Animal removed." }]),
});

export const RemoveAnimalErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/remove" }, { request }],
    [AnimalIdentity.removeAnimal, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});


// GET A SINGLE ANIMAL
export const GetAnimalRequest: Sync = (
  { request, session, id, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/animal/get", session, id },
    { request },
  ]),
  where: async (frames) => {
    const authenticatedFrames = await authenticateRequest(frames, session, user);
    if (authenticatedFrames.length === 0) {
      return new Frames({ ...frames[0], [request]: frames[0][request], error: "Authentication failed. Invalid session." });
    }
    return authenticatedFrames;
  },
  then: actions([
    AnimalIdentity._getAnimal,
    { user, id },
  ]),
});

export const GetAnimalSuccessResponse: Sync = ({ request, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/get" }, { request }],
    [AnimalIdentity._getAnimal, {}, { animal }],
  ),
  then: actions([Requesting.respond, { request, animal }]),
});

export const GetAnimalErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/get" }, { request }],
    [AnimalIdentity._getAnimal, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});


// GET ALL ANIMALS FOR USER
export const GetAllAnimalsRequest: Sync = (
  { request, session, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/animal/getAll", session },
    { request },
  ]),
  where: async (frames) => {
    const authenticatedFrames = await authenticateRequest(frames, session, user);
    if (authenticatedFrames.length === 0) {
      return new Frames({ ...frames[0], [request]: frames[0][request], error: "Authentication failed. Invalid session." });
    }
    return authenticatedFrames;
  },
  then: actions([
    AnimalIdentity._getAllAnimals,
    { user },
  ]),
});

export const GetAllAnimalsSuccessResponse: Sync = ({ request, animals }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/getAll" }, { request }],
    [AnimalIdentity._getAllAnimals, {}, { animals }],
  ),
  then: actions([Requesting.respond, { request, animals }]),
});

export const GetAllAnimalsErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/animal/getAll" }, { request }],
    [AnimalIdentity._getAllAnimals, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});
```
