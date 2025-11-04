[@sync-background](../../tools/sync-background.md)

[@implementation](implementation.md)

[@implementation](../UserAuthentication/implementation.md)


# Prompt: Please write syncs for each of the actions and queries of the HerdGrouping concept so that when a path of the format "/HerdGrouping/ACTION" where ACTION is the action or query in question is called with the arguments to the action, a call is made to UserAuthentication.verify to verify the token and get a user, and then call the action with that user. Make sure that the expected fields in the sync are exactly the inputs to the action associated with that sync.
# response:

Here are the `syncs` for each of the actions and queries of the `HerdGrouping` concept, incorporating user authentication via `UserAuthentication.verify` and ensuring correct argument passing and response handling.

First, ensure your `src/syncs` directory has a file (e.g., `src/syncs/herdGrouping.sync.ts`) and that your `deno.json` `imports` and `tasks` are configured to recognize `@concepts` and `@engine` correctly, and to build the imports if needed.

**`src/syncs/herdGrouping.sync.ts`**

```typescript
// src/syncs/herdGrouping.sync.ts
import { actions, Sync } from "@engine";
import { Requesting, UserAuthentication, HerdGrouping } from "@concepts";

// Define a type for User, consistent with UserAuthentication's return
type User = string; 
type Animal = string; // Assuming Animal is an ID (string)

// =====================================================================
// 1. createHerd Syncs
// (user: User, name: String, description?: String): ({herdName: String} | {error: String})
// =====================================================================

// Handles the initial HTTP request for createHerd, verifies user, and dispatches to HerdGrouping.createHerd
export const CreateHerdRequest: Sync = ({ request, token, name, description }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/createHerd", token, name, description }, { request }],
  ),
  where: async (frames) => {
    // Verify the token to bind the 'user' variable to each frame
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    // Call the HerdGrouping.createHerd action with the authenticated user and other arguments
    [HerdGrouping.createHerd, { user: 'user' as User, name, description }],
  ),
});

// Handles successful completion of HerdGrouping.createHerd and responds to the original request
export const CreateHerdResponse: Sync = ({ request, herdName }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/createHerd" }, { request }], // Matches the original request flow
    [HerdGrouping.createHerd, {}, { herdName }], // Matches successful action output
  ),
  then: actions(
    [Requesting.respond, { request, herdName }], // Responds with the created herd's name
  ),
});

// Handles erroneous completion of HerdGrouping.createHerd and responds with the error
export const CreateHerdResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/createHerd" }, { request }], // Matches the original request flow
    [HerdGrouping.createHerd, {}, { error }], // Matches error action output
  ),
  then: actions(
    [Requesting.respond, { request, error }], // Responds with the error
  ),
});

// =====================================================================
// 2. addAnimal Syncs
// (user: User, herdName: String, animal: Animal): Empty | {error: String}
// =====================================================================

// Handles the initial HTTP request for addAnimal, verifies user, and dispatches to HerdGrouping.addAnimal
export const AddAnimalRequest: Sync = ({ request, token, herdName, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/addAnimal", token, herdName, animal }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping.addAnimal, { user: 'user' as User, herdName, animal }],
  ),
});

// Handles successful completion of HerdGrouping.addAnimal and responds
export const AddAnimalResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/addAnimal" }, { request }],
    [HerdGrouping.addAnimal, {}, {}], // Empty response
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }], // Explicit success message for Empty
  ),
});

// Handles erroneous completion of HerdGrouping.addAnimal and responds with the error
export const AddAnimalResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/addAnimal" }, { request }],
    [HerdGrouping.addAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 3. removeAnimal Syncs
// (user: User, herdName: String, animal: Animal): Empty | {error: String}
// =====================================================================

// Handles the initial HTTP request for removeAnimal, verifies user, and dispatches to HerdGrouping.removeAnimal
export const RemoveAnimalRequest: Sync = ({ request, token, herdName, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/removeAnimal", token, herdName, animal }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping.removeAnimal, { user: 'user' as User, herdName, animal }],
  ),
});

// Handles successful completion of HerdGrouping.removeAnimal and responds
export const RemoveAnimalResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/removeAnimal" }, { request }],
    [HerdGrouping.removeAnimal, {}, {}], // Empty response
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

// Handles erroneous completion of HerdGrouping.removeAnimal and responds with the error
export const RemoveAnimalResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/removeAnimal" }, { request }],
    [HerdGrouping.removeAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 4. moveAnimal Syncs
// (user: User, sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}
// =====================================================================

// Handles the initial HTTP request for moveAnimal, verifies user, and dispatches to HerdGrouping.moveAnimal
export const MoveAnimalRequest: Sync = ({ request, token, sourceHerdName, targetHerdName, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/moveAnimal", token, sourceHerdName, targetHerdName, animal }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping.moveAnimal, { user: 'user' as User, sourceHerdName, targetHerdName, animal }],
  ),
});

// Handles successful completion of HerdGrouping.moveAnimal and responds
export const MoveAnimalResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/moveAnimal" }, { request }],
    [HerdGrouping.moveAnimal, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

// Handles erroneous completion of HerdGrouping.moveAnimal and responds with the error
export const MoveAnimalResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/moveAnimal" }, { request }],
    [HerdGrouping.moveAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 5. mergeHerds Syncs
// (user: User, herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}
// =====================================================================

// Handles the initial HTTP request for mergeHerds, verifies user, and dispatches to HerdGrouping.mergeHerds
export const MergeHerdsRequest: Sync = ({ request, token, herdNameToKeep, herdNameToArchive }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/mergeHerds", token, herdNameToKeep, herdNameToArchive }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping.mergeHerds, { user: 'user' as User, herdNameToKeep, herdNameToArchive }],
  ),
});

// Handles successful completion of HerdGrouping.mergeHerds and responds
export const MergeHerdsResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/mergeHerds" }, { request }],
    [HerdGrouping.mergeHerds, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

// Handles erroneous completion of HerdGrouping.mergeHerds and responds with the error
export const MergeHerdsResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/mergeHerds" }, { request }],
    [HerdGrouping.mergeHerds, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 6. splitHerd Syncs
// (user: User, sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}
// =====================================================================

// Handles the initial HTTP request for splitHerd, verifies user, and dispatches to HerdGrouping.splitHerd
export const SplitHerdRequest: Sync = ({ request, token, sourceHerdName, targetHerdName, animalsToMove }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/splitHerd", token, sourceHerdName, targetHerdName, animalsToMove }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping.splitHerd, { user: 'user' as User, sourceHerdName, targetHerdName, animalsToMove }],
  ),
});

// Handles successful completion of HerdGrouping.splitHerd and responds
export const SplitHerdResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/splitHerd" }, { request }],
    [HerdGrouping.splitHerd, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

// Handles erroneous completion of HerdGrouping.splitHerd and responds with the error
export const SplitHerdResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/splitHerd" }, { request }],
    [HerdGrouping.splitHerd, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 7. deleteHerd Syncs
// (user: User, herdName: String): Empty | {error: String}
// =====================================================================

// Handles the initial HTTP request for deleteHerd, verifies user, and dispatches to HerdGrouping.deleteHerd
export const DeleteHerdRequest: Sync = ({ request, token, herdName }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/deleteHerd", token, herdName }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping.deleteHerd, { user: 'user' as User, herdName }],
  ),
});

// Handles successful completion of HerdGrouping.deleteHerd and responds
export const DeleteHerdResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/deleteHerd" }, { request }],
    [HerdGrouping.deleteHerd, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

// Handles erroneous completion of HerdGrouping.deleteHerd and responds with the error
export const DeleteHerdResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/deleteHerd" }, { request }],
    [HerdGrouping.deleteHerd, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 8. restoreHerd Syncs
// (user: User, herdName: String): Empty | {error: String}
// =====================================================================

// Handles the initial HTTP request for restoreHerd, verifies user, and dispatches to HerdGrouping.restoreHerd
export const RestoreHerdRequest: Sync = ({ request, token, herdName }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/restoreHerd", token, herdName }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping.restoreHerd, { user: 'user' as User, herdName }],
  ),
});

// Handles successful completion of HerdGrouping.restoreHerd and responds
export const RestoreHerdResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/restoreHerd" }, { request }],
    [HerdGrouping.restoreHerd, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

// Handles erroneous completion of HerdGrouping.restoreHerd and responds with the error
export const RestoreHerdResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/restoreHerd" }, { request }],
    [HerdGrouping.restoreHerd, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 9. _viewComposition Syncs (Query)
// (user: User, herdName: String): ({animals: Array<Animal>} | {error: String})
// =====================================================================

// Handles the initial HTTP request for _viewComposition, verifies user, and dispatches to HerdGrouping._viewComposition
export const ViewCompositionRequest: Sync = ({ request, token, herdName }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_viewComposition", token, herdName }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping._viewComposition, { user: 'user' as User, herdName }],
  ),
});

// Handles successful completion of HerdGrouping._viewComposition and responds with the animals
export const ViewCompositionResponse: Sync = ({ request, animals }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_viewComposition" }, { request }],
    [HerdGrouping._viewComposition, {}, { animals }], // Bind 'animals' from query result
  ),
  then: actions(
    [Requesting.respond, { request, animals }],
  ),
});

// Handles erroneous completion of HerdGrouping._viewComposition and responds with the error
export const ViewCompositionResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_viewComposition" }, { request }],
    [HerdGrouping._viewComposition, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 10. _listActiveHerds Syncs (Query)
// (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
// =====================================================================

// Handles the initial HTTP request for _listActiveHerds, verifies user, and dispatches to HerdGrouping._listActiveHerds
export const ListActiveHerdsRequest: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listActiveHerds", token }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping._listActiveHerds, { user: 'user' as User }],
  ),
});

// Handles successful completion of HerdGrouping._listActiveHerds and responds with the herds
export const ListActiveHerdsResponse: Sync = ({ request, herds }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listActiveHerds" }, { request }],
    [HerdGrouping._listActiveHerds, {}, { herds }], // Bind 'herds' from query result
  ),
  then: actions(
    [Requesting.respond, { request, herds }],
  ),
});

// Handles erroneous completion of HerdGrouping._listActiveHerds and responds with the error
export const ListActiveHerdsResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listActiveHerds" }, { request }],
    [HerdGrouping._listActiveHerds, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 11. _listArchivedHerds Syncs (Query)
// (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
// =====================================================================

// Handles the initial HTTP request for _listArchivedHerds, verifies user, and dispatches to HerdGrouping._listArchivedHerds
export const ListArchivedHerdsRequest: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listArchivedHerds", token }, { request }],
  ),
  where: async (frames) => {
    return await frames.query(UserAuthentication.verify, { token }, { user: 'user' as User });
  },
  then: actions(
    [HerdGrouping._listArchivedHerds, { user: 'user' as User }],
  ),
});

// Handles successful completion of HerdGrouping._listArchivedHerds and responds with the herds
export const ListArchivedHerdsResponse: Sync = ({ request, herds }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listArchivedHerds" }, { request }],
    [HerdGrouping._listArchivedHerds, {}, { herds }], // Bind 'herds' from query result
  ),
  then: actions(
    [Requesting.respond, { request, herds }],
  ),
});

// Handles erroneous completion of HerdGrouping._listArchivedHerds and responds with the error
export const ListArchivedHerdsResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listArchivedHerds" }, { request }],
    [HerdGrouping._listArchivedHerds, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});
```

# Prompt: Rewrite the syncs to use verifyAdapter. Below is the implementation of verifyAdapter and an example of a sync for a different concept using verifyAdapter
// Helper adapter for UserAuthentication.verify to fit frames.query
// It will always return an array with one element: either { user: ID } or { error: string }
const verifyAdapter = async (
  { sessionToken }: { sessionToken: string },
): Promise<({ user: ID } | { error: string })[]> => {
  const result = await UserAuthentication.verify({ token: sessionToken });
  if ("user" in result) {
    return [{ user: result.user as ID }];
  }
  if ("error" in result) {
    return [{ error: result.error }];
  }
  return [];
};

export const RegisterAnimalRequest: Sync = ({
  request,
  token,
  id,
  species,
  sex,
  birthDate,
  breed, // This variable will capture 'breed' if present in the incoming request
  notes, // This variable will capture 'notes' if present in the incoming request
  user,
  authError,
}) => ({
  when: actions([
    Requesting.request,
    {
      path: "/AnimalIdentity/registerAnimal",
      token,
      id,
      species,
      sex,
      birthDate, // birthDate is still required by this pattern
      breed,
      notes,
      // breed and notes are intentionally omitted from this input pattern
      // making them optional for the incoming request
    },
    { request }, // <--- NOW IN THE OUTPUT PATTERN: captures them if they exist
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, {
      sessionToken: token,
    }, { user, error: authError });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return parseDateIfString(frames, birthDate);
  },
  then: actions(
    [AnimalIdentity.registerAnimal, {
      user,
      id,
      species,
      sex,
      birthDate,
      breed, // Will be `undefined` if not provided in the Requesting.request,
      // which the AnimalIdentityConcept.registerAnimal correctly handles.
      notes, // Will be `undefined` if not provided in the Requesting.request,
      // which the AnimalIdentityConcept.registerAnimal correctly handles.
    }],
  ),
});

export const RegisterAnimalResponseSuccess: Sync = ({ request, animal }) => ({
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

export const RegisterAnimalResponseError: Sync = ({ request, error }) => ({
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
# response:

Okay, let's rewrite the `HerdGrouping` syncs to incorporate the `verifyAdapter` for user authentication.

First, we need to define the `verifyAdapter` and import necessary concepts.

**`src/syncs/herdGrouping.sync.ts`**

```typescript
import { actions, Frames as _Frames, Sync } from "@engine"; // Import Frames for default empty frames
import { HerdGrouping, Requesting, UserAuthentication } from "@concepts";
import { ID } from "@utils/types.ts";

// Define a type for User, consistent with UserAuthentication's return (ID is a branded string)
type User = ID;
type Animal = ID; // Assuming Animal is an ID (string)

// =====================================================================
// Helper adapter for UserAuthentication.verify to fit frames.query
// It will always return an array with one element: either { user: ID } or { error: string }
const verifyAdapter = async (
  { sessionToken }: { sessionToken: string },
): Promise<({ user: ID } | { error: string })[]> => {
  const result = await UserAuthentication.verify({ token: sessionToken });
  if ("user" in result) {
    return [{ user: result.user as ID }];
  }
  if ("error" in result) {
    return [{ error: result.error }];
  }
  return []; // Should ideally not be reached if verify always returns user or error
};

// =====================================================================
// Adapters for HerdGrouping queries (for frames.query usage)
// Always return arrays per frames.query contract
// =====================================================================
const viewCompositionAdapter = async (
  { user, herdName }: { user: ID; herdName: string },
): Promise<({ animals: unknown[] } | { error: string })[]> => {
  const result = await HerdGrouping._viewComposition({ user, herdName });
  if ("error" in result) return [{ error: result.error }];
  return [{ animals: result.animals }];
};

const listActiveHerdsAdapter = async (
  { user }: { user: ID },
): Promise<{ herds: unknown[] }[]> => {
  const result = await HerdGrouping._listActiveHerds({ user });
  return [{ herds: result.herds }];
};

const listArchivedHerdsAdapter = async (
  { user }: { user: ID },
): Promise<{ herds: unknown[] }[]> => {
  const result = await HerdGrouping._listArchivedHerds({ user });
  return [{ herds: result.herds }];
};

// =====================================================================
// Global Authentication Error Handler Sync
// This catches any request where verifyAdapter fails, and responds with the auth error
// =====================================================================
export const HandleAuthenticationError: Sync = (
  { request, authError },
) => ({
  when: actions([
    Requesting.request,
    {}, // Match any request
    { request },
  ]),
  where: (frames) => {
    // This is a placeholder that will be expanded in individual syncs' where clauses
    // We expect 'authError' to be bound in frames coming into this sync's where
    return frames.filter(($) => $[authError] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// =====================================================================
// 1. createHerd Syncs
// (user: User, name: String, description?: String): ({herdName: String} | {error: String})
// =====================================================================

export const CreateHerdRequest: Sync = (
  { request, token, name, description, user, authError },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/HerdGrouping/createHerd",
      token,
      name,
      description,
    }, { request }],
  ),
  where: async (frames) => {
    // Verify the token to bind 'user' or 'authError'
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    // Filter out frames where authentication failed
    return frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
  },
  then: actions(
    // Call the HerdGrouping.createHerd action with the authenticated user and other arguments
    [HerdGrouping.createHerd, { user, name, description }],
  ),
});

export const CreateHerdResponseSuccess: Sync = ({ request, herdName }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/createHerd" }, { request }],
    [HerdGrouping.createHerd, {}, { herdName }],
  ),
  then: actions(
    [Requesting.respond, { request, herdName }],
  ),
});

export const CreateHerdResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/createHerd" }, { request }],
    [HerdGrouping.createHerd, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 2. addAnimal Syncs
// (user: User, herdName: String, animal: Animal): Empty | {error: String}
// =====================================================================

export const AddAnimalRequest: Sync = (
  { request, token, herdName, animal, user, authError },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/HerdGrouping/addAnimal",
      token,
      herdName,
      animal,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    return frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
  },
  then: actions(
    [HerdGrouping.addAnimal, { user, herdName, animal }],
  ),
});

export const AddAnimalResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/addAnimal" }, { request }],
    [HerdGrouping.addAnimal, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const AddAnimalResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/addAnimal" }, { request }],
    [HerdGrouping.addAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 3. removeAnimal Syncs
// (user: User, herdName: String, animal: Animal): Empty | {error: String}
// =====================================================================

export const RemoveAnimalRequest: Sync = (
  { request, token, herdName, animal, user, authError },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/HerdGrouping/removeAnimal",
      token,
      herdName,
      animal,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    return frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
  },
  then: actions(
    [HerdGrouping.removeAnimal, { user, herdName, animal }],
  ),
});

export const RemoveAnimalResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/removeAnimal" }, { request }],
    [HerdGrouping.removeAnimal, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const RemoveAnimalResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/removeAnimal" }, { request }],
    [HerdGrouping.removeAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 4. moveAnimal Syncs
// (user: User, sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}
// =====================================================================

export const MoveAnimalRequest: Sync = (
  { request, token, sourceHerdName, targetHerdName, animal, user, authError },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/HerdGrouping/moveAnimal",
      token,
      sourceHerdName,
      targetHerdName,
      animal,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    return frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
  },
  then: actions(
    [HerdGrouping.moveAnimal, { user, sourceHerdName, targetHerdName, animal }],
  ),
});

export const MoveAnimalResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/moveAnimal" }, { request }],
    [HerdGrouping.moveAnimal, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const MoveAnimalResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/moveAnimal" }, { request }],
    [HerdGrouping.moveAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 5. mergeHerds Syncs
// (user: User, herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}
// =====================================================================

export const MergeHerdsRequest: Sync = (
  { request, token, herdNameToKeep, herdNameToArchive, user, authError },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/HerdGrouping/mergeHerds",
      token,
      herdNameToKeep,
      herdNameToArchive,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    return frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
  },
  then: actions(
    [HerdGrouping.mergeHerds, { user, herdNameToKeep, herdNameToArchive }],
  ),
});

export const MergeHerdsResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/mergeHerds" }, { request }],
    [HerdGrouping.mergeHerds, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const MergeHerdsResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/mergeHerds" }, { request }],
    [HerdGrouping.mergeHerds, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 6. splitHerd Syncs
// (user: User, sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}
// =====================================================================

export const SplitHerdRequest: Sync = (
  {
    request,
    token,
    sourceHerdName,
    targetHerdName,
    animalsToMove,
    user,
    authError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/HerdGrouping/splitHerd",
      token,
      sourceHerdName,
      targetHerdName,
      animalsToMove,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    return frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
  },
  then: actions(
    [HerdGrouping.splitHerd, {
      user,
      sourceHerdName,
      targetHerdName,
      animalsToMove,
    }],
  ),
});

export const SplitHerdResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/splitHerd" }, { request }],
    [HerdGrouping.splitHerd, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const SplitHerdResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/splitHerd" }, { request }],
    [HerdGrouping.splitHerd, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 7. deleteHerd Syncs
// (user: User, herdName: String): Empty | {error: String}
// =====================================================================

export const DeleteHerdRequest: Sync = (
  { request, token, herdName, user, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/HerdGrouping/deleteHerd", token, herdName },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    return frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
  },
  then: actions(
    [HerdGrouping.deleteHerd, { user, herdName }],
  ),
});

export const DeleteHerdResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/deleteHerd" }, { request }],
    [HerdGrouping.deleteHerd, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const DeleteHerdResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/deleteHerd" }, { request }],
    [HerdGrouping.deleteHerd, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 8. restoreHerd Syncs
// (user: User, herdName: String): Empty | {error: String}
// =====================================================================

export const RestoreHerdRequest: Sync = (
  { request, token, herdName, user, authError },
) => ({
  when: actions(
    [
      Requesting.request,
      { path: "/HerdGrouping/restoreHerd", token, herdName },
      { request },
    ],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    return frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
  },
  then: actions(
    [HerdGrouping.restoreHerd, { user, herdName }],
  ),
});

export const RestoreHerdResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/restoreHerd" }, { request }],
    [HerdGrouping.restoreHerd, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const RestoreHerdResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/restoreHerd" }, { request }],
    [HerdGrouping.restoreHerd, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// =====================================================================
// 9. _viewComposition Syncs (Query)
// (user: User, herdName: String): ({animals: Array<Animal>} | {error: String})
// =====================================================================

export const ViewCompositionRequest: Sync = (
  { request, token, herdName, user, authError, animals, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/HerdGrouping/_viewComposition",
      token,
      herdName,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    frames = await frames.query(viewCompositionAdapter, { user, herdName }, {
      animals,
      error,
    });
    // Ensure both symbols exist to avoid missing binding errors
    frames = frames.map(($) => ({
      ...$,
      [animals]: $[animals],
      [error]: $[error],
    }));
    return frames;
  },
  then: actions(
    [Requesting.respond, { request, animals, error }],
  ),
});

// Note: Success/Error response syncs tied to instrumented concept actions are removed
// because queries now run in where via adapters and respond directly

// =====================================================================
// 10. _listActiveHerds Syncs (Query)
// (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
// =====================================================================

export const ListActiveHerdsRequest: Sync = (
  { request, token, user, authError, herds },
) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listActiveHerds", token }, {
      request,
    }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return await frames.query(listActiveHerdsAdapter, { user }, { herds });
  },
  then: actions(
    [Requesting.respond, { request, herds }],
  ),
});

// Response syncs removed; direct respond happens in request sync

// =====================================================================
// 11. _listArchivedHerds Syncs (Query)
// (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
// =====================================================================

export const ListArchivedHerdsRequest: Sync = (
  { request, token, user, authError, herds },
) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listArchivedHerds", token }, {
      request,
    }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return await frames.query(listArchivedHerdsAdapter, { user }, { herds });
  },
  then: actions(
    [Requesting.respond, { request, herds }],
  ),
});
```

# Prompt: what might cause this error. Most of the others seem to be working, but _viewComposition is having issues.
Requesting.request {
  herdName: '1',
  token: '019a45e1-1f5d-7c6a-b973-a6acce4213ec',
  path: '/HerdGrouping/_viewComposition'
} => { request: '019a469d-cc3d-7124-9ba8-b610656bff2f' }

[AUTH-CONCEPT] verify(): received token type=string value=019a45e1-1f5d-7c6a-b973-a6acce4213ec
[AUTH-CONCEPT] verify(): querying activeSessions with _id=019a45e1-1f5d-7c6a-b973-a6acce4213ec
[AUTH-CONCEPT] verify(): query result present=true details={"_id":"019a45e1-1f5d-7c6a-b973-a6acce4213ec","username":"Cal"}
[AUTH-CONCEPT] verify(): token valid; username=Cal

UserAuthentication.verify { token: '019a45e1-1f5d-7c6a-b973-a6acce4213ec' } => { user: 'Cal' }

[Requesting] Error processing request: Missing binding: Symbol(error) in frame: [object Object]
# response:

The error message `Missing binding: Symbol(error) in frame: [object Object]` indicates that the symbol `error` is being accessed in a frame where it hasn't been bound. This happens within your `_viewComposition` sync (and potentially other query syncs) when `HerdGrouping._viewComposition` is successful.

Let's break down the flow in `ViewCompositionRequest`:

1.  **Authentication:** `frames.query(verifyAdapter, ..., { user, error: authError })`
    *   If successful, `user` is bound. `authError` is *not* bound.
    *   The filter `frames.filter(($) => $[user] !== undefined && $[authError] === undefined)` keeps these successful frames.
2.  **Query Execution:** `frames = await frames.query(viewCompositionAdapter, { user, herdName }, { animals, error });`
    *   This calls `viewCompositionAdapter`.
    *   If `HerdGrouping._viewComposition` is successful, `viewCompositionAdapter` returns `[{ animals: [...] }]`.
    *   When `frames.query` processes this result with the output pattern `{ animals, error }`:
        *   `animals` is bound correctly from `result.animals`.
        *   `error` is **not bound**, because the adapter didn't return an `error` property in the successful case.
3.  **Problematic `map` (from previous versions of the code, but the same logic applies to where the error is detected):** `frames = frames.map(($) => ({ ...$, [animals]: $[animals], [error]: $[error], }));`
    *   This line attempts to access `$[error]`. Since the `error` symbol was not bound by `frames.query` in the successful path, trying to access `$[error]` results in the "Missing binding" error.

The core issue is that when you specify `{ animals, error }` as the output pattern for `frames.query`, and then later explicitly (or implicitly, if the engine is strict) reference `error`, the system expects `error` to be a bound symbol in *every* frame that proceeds, even if its value would be `undefined`.

### Solution: Ensure All Output Symbols Are Always Bound

The most robust way to fix this, given the framework's strictness about symbol bindings, is to modify your query adapters (`viewCompositionAdapter`, `listActiveHerdsAdapter`, `listArchivedHerdsAdapter`) to **always return all specified output properties, with `undefined` for those that are not relevant to the current outcome (success or error).**

This guarantees that `frames.query` will always bind *both* `animals` and `error` (or `herds` and `error`) symbols in the frame, preventing the "Missing binding" error.

### 1. Update Query Adapters (`src/syncs/herdGrouping.sync.ts`)

```typescript
// src/syncs/herdGrouping.sync.ts (Changes to query adapters)
import { actions, Frames as _Frames, Sync } from "@engine";
import { HerdGrouping, Requesting, UserAuthentication } from "@concepts";
import { ID } from "@utils/types.ts";

// Define a type for User, consistent with UserAuthentication's return (ID is a branded string)
type User = ID;
type Animal = ID; // Assuming Animal is an ID (string)

// Helper adapter for UserAuthentication.verify to fit frames.query
// It will always return an array with one element: either { user: ID } or { error: string }
const verifyAdapter = async (
  { sessionToken }: { sessionToken: string },
): Promise<({ user: ID } | { error: string })[]> => {
  const result = await UserAuthentication.verify({ token: sessionToken });
  if ("user" in result) {
    return [{ user: result.user as ID }];
  }
  if ("error" in result) {
    return [{ error: result.error }];
  }
  return [];
};

// =====================================================================
// Adapters for HerdGrouping queries (for frames.query usage)
// NOW ALWAYS RETURN BOTH SUCCESS AND ERROR PROPERTIES, ONE WILL BE UNDEFINED
// =====================================================================

const viewCompositionAdapter = async (
  { user, herdName }: { user: ID; herdName: string },
): Promise<({ animals?: unknown[]; error?: string })[]> => { // Changed return type to allow undefined
  const result = await HerdGrouping._viewComposition({ user, herdName });
  if ("error" in result) {
    return [{ error: result.error, animals: undefined }]; // Explicitly set animals to undefined
  }
  return [{ animals: result.animals, error: undefined }]; // Explicitly set error to undefined
};

const listActiveHerdsAdapter = async (
  { user }: { user: ID },
): Promise<({ herds?: unknown[]; error?: string })[]> => { // Changed return type
  const result = await HerdGrouping._listActiveHerds({ user });
  // Assuming _listActiveHerds will only return { herds: [...] } on success and won't have an 'error' field
  // If it *could* return an error, you'd add: if ("error" in result) return [{ error: result.error, herds: undefined }];
  return [{ herds: result.herds, error: undefined }]; // Explicitly set error to undefined
};

const listArchivedHerdsAdapter = async (
  { user }: { user: ID },
): Promise<({ herds?: unknown[]; error?: string })[]> => { // Changed return type
  const result = await HerdGrouping._listArchivedHerds({ user });
  // Same assumption as above: only returns { herds: [...] } on success
  return [{ herds: result.herds, error: undefined }]; // Explicitly set error to undefined
};

// =====================================================================
// Rest of your syncs (only the query request syncs need minor adjustment)
// =====================================================================

// Global Authentication Error Handler (no change needed here)
export const HandleAuthenticationError: Sync = (
  { request, authError },
) => ({
  when: actions([
    Requesting.request,
    {}, // Match any request
    { request },
  ]),
  where: (frames) => {
    return frames.filter(($) => $[authError] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// ... (All action syncs like CreateHerdRequest, CreateHerdResponseSuccess, CreateHerdResponseError remain unchanged) ...

// =====================================================================
// 9. _viewComposition Syncs (Query)
// (user: User, herdName: String): ({animals: Array<Animal>} | {error: String})
// =====================================================================

export const ViewCompositionRequest: Sync = (
  { request, token, herdName, user, authError, animals, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/HerdGrouping/_viewComposition",
      token,
      herdName,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    // Call the query adapter. Now it will always bind BOTH 'animals' and 'error' symbols.
    return await frames.query(viewCompositionAdapter, { user, herdName }, {
      animals,
      error,
    });
    // The problematic `frames.map` line is removed, as it's no longer necessary with the adapter change
  },
  then: actions(
    // Requesting.respond will receive both 'animals' and 'error' as bound symbols.
    // One will have a value, the other will be undefined, and Requesting.respond should omit undefined fields from JSON.
    [Requesting.respond, { request, animals, error }],
  ),
});

// Note: Removed the now-obsolete `ViewCompositionResponseSuccess` and `ViewCompositionResponseError`
// syncs because the `QueryRequest` sync now handles the response directly in its `then` clause.
// This is typical for queries that don't modify state and are purely for data retrieval.

// =====================================================================
// 10. _listActiveHerds Syncs (Query)
// (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
// =====================================================================

export const ListActiveHerdsRequest: Sync = (
  { request, token, user, authError, herds, error }, // Added 'error' to output variables
) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listActiveHerds", token }, {
      request,
    }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    // Call the query adapter. Now it will always bind BOTH 'herds' and 'error' symbols.
    return await frames.query(listActiveHerdsAdapter, { user }, { herds, error });
  },
  then: actions(
    [Requesting.respond, { request, herds, error }], // Pass both
  ),
});

// Response syncs removed; direct respond happens in request sync

// =====================================================================
// 11. _listArchivedHerds Syncs (Query)
// (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
// =====================================================================

export const ListArchivedHerdsRequest: Sync = (
  { request, token, user, authError, herds, error }, // Added 'error' to output variables
) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listArchivedHerds", token }, {
      request,
    }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });
    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    // Call the query adapter. Now it will always bind BOTH 'herds' and 'error' symbols.
    return await frames.query(listArchivedHerdsAdapter, { user }, { herds, error });
  },
  then: actions(
    [Requesting.respond, { request, herds, error }], // Pass both
  ),
});
```

### Explanation of the Fix:

By explicitly including `error: undefined` in the successful return of your adapters (and `animals: undefined` or `herds: undefined` in the error returns if applicable), you ensure that when `frames.query` processes the results, the `error` symbol (and other output symbols) is always a valid key in the resulting frame objects, even if its value is `undefined`. This resolves the "Missing binding" error because the symbol is always present, preventing the framework from complaining about an entirely missing reference.