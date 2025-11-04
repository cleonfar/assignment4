---
timestamp: 'Sun Nov 02 2025 16:28:38 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_162838.e04f16c9.md]]'
content_id: 93d286a6420b6540b5376e135a361ad2958ea23a185e43f07fffa05e0c0c629d
---

# response:

Okay, let's rewrite the `HerdGrouping` syncs to incorporate the `verifyAdapter` for user authentication.

First, we need to define the `verifyAdapter` and import necessary concepts.

**`src/syncs/herdGrouping.sync.ts`**

```typescript
// src/syncs/herdGrouping.sync.ts
import { actions, Sync, Frames } from "@engine"; // Import Frames for default empty frames
import { Requesting, UserAuthentication, HerdGrouping } from "@concepts";
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
  where: async (frames) => {
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
    [Requesting.request, { path: "/HerdGrouping/createHerd", token, name, description }, { request }],
  ),
  where: async (frames) => {
    // Verify the token to bind 'user' or 'authError'
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    // Filter out frames where authentication failed
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
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
    [Requesting.request, { path: "/HerdGrouping/addAnimal", token, herdName, animal }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
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
    [Requesting.request, { path: "/HerdGrouping/removeAnimal", token, herdName, animal }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
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
    [Requesting.request, { path: "/HerdGrouping/moveAnimal", token, sourceHerdName, targetHerdName, animal }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
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
    [Requesting.request, { path: "/HerdGrouping/mergeHerds", token, herdNameToKeep, herdNameToArchive }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
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
  { request, token, sourceHerdName, targetHerdName, animalsToMove, user, authError },
) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/splitHerd", token, sourceHerdName, targetHerdName, animalsToMove }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
  },
  then: actions(
    [HerdGrouping.splitHerd, { user, sourceHerdName, targetHerdName, animalsToMove }],
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
    [Requesting.request, { path: "/HerdGrouping/deleteHerd", token, herdName }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
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
    [Requesting.request, { path: "/HerdGrouping/restoreHerd", token, herdName }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
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
  { request, token, herdName, user, authError },
) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_viewComposition", token, herdName }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
  },
  then: actions(
    [HerdGrouping._viewComposition, { user, herdName }],
  ),
});

export const ViewCompositionResponseSuccess: Sync = ({ request, animals }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_viewComposition" }, { request }],
    [HerdGrouping._viewComposition, {}, { animals }],
  ),
  then: actions(
    [Requesting.respond, { request, animals }],
  ),
});

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

export const ListActiveHerdsRequest: Sync = (
  { request, token, user, authError },
) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listActiveHerds", token }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
  },
  then: actions(
    [HerdGrouping._listActiveHerds, { user }],
  ),
});

export const ListActiveHerdsResponseSuccess: Sync = ({ request, herds }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listActiveHerds" }, { request }],
    [HerdGrouping._listActiveHerds, {}, { herds }],
  ),
  then: actions(
    [Requesting.respond, { request, herds }],
  ),
});

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

export const ListArchivedHerdsRequest: Sync = (
  { request, token, user, authError },
) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listArchivedHerds", token }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, { user, error: authError });
    return frames.filter(($) => $[user] !== undefined && $[authError] === undefined);
  },
  then: actions(
    [HerdGrouping._listArchivedHerds, { user }],
  ),
});

export const ListArchivedHerdsResponseSuccess: Sync = ({ request, herds }) => ({
  when: actions(
    [Requesting.request, { path: "/HerdGrouping/_listArchivedHerds" }, { request }],
    [HerdGrouping._listArchivedHerds, {}, { herds }],
  ),
  then: actions(
    [Requesting.respond, { request, herds }],
  ),
});

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
