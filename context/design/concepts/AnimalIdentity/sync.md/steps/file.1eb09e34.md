---
timestamp: 'Sat Nov 01 2025 21:48:48 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251101_214848.3c1f98c7.md]]'
content_id: 1eb09e3414180817fa0a4842f342d923c604bf032f1b8c5c338a8b2217519448
---

# file: src/concepts/UserAuthentication/UserAuthenticationConcept.ts (Updated)

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
  _id: User; // The unique identifier for the user (internal to UserAuthentication)
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
    // Ensure unique index for username
    this.users.createIndex({ username: 1 }, { unique: true });
    // Ensure unique index for session token (which is _id)
    this.activeSessions.createIndex({ _id: 1 }, { unique: true });
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
   * login (username: String, password: String): (token: String)
   * login (username: String, password: String): (error: String)
   *
   * **requires**
   *   there exists a User 'u' such that u's username is 'username' AND u's password is 'password'
   *
   * **effects**
   *   If authentication is successful, creates a new active session for the user
   *   returns the new session token
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
   * verify (token: String): (username: String)
   * verify (token: String): (error: String)
   *
   * **requires** the session token is in the set of activeSessions
   *
   * **effects** returns the username associated with the session
   */
  async verify(
    { token }: { token: SessionToken },
  ): Promise<{ username: string } | { error: string }> {
    // Check precondition: the session token is in the set of activeSessions
    const session = await this.activeSessions.findOne({ _id: token });
    if (!session) {
      return { error: "Invalid or expired session token." };
    }

    // Effects: returns the username associated with the session
    return { username: session.username };
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

  // Removed: _getUserIDByUsername as it's no longer needed for AnimalIdentity
  // _getUserIDByUsername (username: String): (userID: User)
  // ...
}
```

***

## Update: AnimalIdentity Concept Specification
