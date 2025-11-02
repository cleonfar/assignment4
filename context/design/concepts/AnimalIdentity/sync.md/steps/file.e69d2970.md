---
timestamp: 'Sat Nov 01 2025 21:42:28 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251101_214228.f54c2a29.md]]'
content_id: e69d29708622dc7dff59ad49ac8200016767a3e8c2fb0fd9936e66ed72e42bdc
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

  /**
   * _getUserIDByUsername (username: String): (userID: User)
   * _getUserIDByUsername (username: String): (error: String)
   * @requires user with `username` exists
   * @effects returns the `_id` (User) of the user
   */
  async _getUserIDByUsername(
    { username }: { username: string },
  ): Promise<{ userID: User } | { error: string }> {
    try {
      const userDoc = await this.users.findOne({ username });
      if (!userDoc) {
        return { error: `User with username '${username}' not found.` };
      }
      return { userID: userDoc._id };
    } catch (e) {
      console.error("Error fetching user ID by username:", e);
      return { error: "Failed to fetch user ID due to a database error." };
    }
  }
}
```

***

## Synchronization Files

For these synchronizations, we assume the existence of a `Requesting` concept as described in the introductory text, which handles incoming HTTP requests and outgoing responses.

**Assumed `Requesting` Concept actions:**

* `request (path: string, method: string, session?: ID, ...params: any): (request: ID, path: string, method: string, ...params: any)`
  * This will trigger the `when` clauses of our syncs.
  * `session` will be used for authentication.
* `respond (request: ID, status: number, body: unknown): Empty`
  * This will be called in the `then` clauses to send HTTP responses.

***

### Syncs for User Authentication

These synchronizations handle requests related to user registration, login, and logout.
