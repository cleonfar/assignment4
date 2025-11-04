---
timestamp: 'Sun Nov 02 2025 16:23:57 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_162357.ef3020ba.md]]'
content_id: 0bdbc2579c6d3cba5e8ca686cf4d1ef572019f16c79248236d614ccbcff4dc93
---

# file: src/syncs/herdGrouping.sync.ts

```typescript
// src/syncs/herdGrouping.sync.ts
import { actions, Sync, Frames } from "@engine";
import { ID } from "@utils/types.ts";
import { Requesting, UserAuthentication, HerdGrouping } from "@concepts";

// Define a type for User, consistent with UserAuthentication's return (which is ID)
type User = ID;
type Animal = ID; // Assuming Animal is an ID (string)

// Helper adapter for UserAuthentication.verify to fit frames.query
// It will always return an array with one element: either { user: ID } or { error: string }
const verifyAdapter = async (
  { sessionToken }: { sessionToken: string },
): Promise<({ user: User } | { error: string })[]> => {
  const result = await UserAuthentication.verify({ token: sessionToken });
  if ("user" in result) {
    return [{ user: result.user as User }];
  }
  if ("error" in result) {
    return [{ error: result.error }];
  }
  // This case should ideally not be reached if UserAuthentication.verify always returns user or error.
  return [];
};

// Common pattern for handling Request -> Verify -> Action/Error Response
// actionParamsToBind: List of string keys from Requesting.request that are inputs to actionFn,
//                     excluding 'token' as that's handled for authentication.
const withAuthentication = (
  syncName: string,
  path: string,
  actionFn: Function, // The HerdGrouping action/query function, e.g., HerdGrouping.createHerd
  actionParamsToBind: string[], // List of parameter names expected by the actionFn (e.g., ['name', 'description'])
  actionOutputPattern: Record<string, any> = {}, // Expected output fields for success (e.g., { herdName: 'herdName' })
) => {
  // Create an object like { name: 'name', description: 'description' } for dynamic binding.
  // This helps bind parameters from the incoming Requesting.request event to variables.
  const dynamicRequestAndActionInputs = actionParamsToBind.reduce((acc, param) => {
    acc[param] = param; // Binds request field `param` to variable `param`
    return acc;
  }, {} as Record<string, any>);

  // 1. Authenticated Request leading to Action execution
  // This sync fires if the HTTP request comes in AND authentication succeeds.
  const requestAuthenticated: Sync = ({ request, token, ...boundParamsFromRequest }) => ({
    name: `${syncName}RequestAuthenticated`,
    when: actions(
      // Match the incoming request, binding 'request', 'token', and all specified action inputs.
      [Requesting.request, { path, token, ...dynamicRequestAndActionInputs }, { request }],
    ),
    where: async (frames) => {
      // Query the verifyAdapter. If successful, 'user' will be bound in the frames.
      frames = await frames.query(verifyAdapter, { sessionToken: token }, { user: 'user' as User });
      // Frames where verifyAdapter returned an error will not have a 'user' binding and will be filtered out here.
      return frames;
    },
    then: actions(
      // Call the HerdGrouping action/query with the authenticated user and the specific inputs.
      [actionFn, { user: 'user' as User, ...dynamicRequestAndActionInputs }],
    ),
  });

  // 2. Authentication Failed path: Request -> Verify(error) -> Respond with error
  // This sync fires if the HTTP request comes in AND authentication fails.
  const requestAuthenticationError: Sync = ({ request, token, ...boundParamsFromRequest }) => ({
    name: `${syncName}RequestAuthenticationError`,
    when: actions(
      // Match the incoming request, binding 'request', 'token', and all specified action inputs.
      [Requesting.request, { path, token, ...dynamicRequestAndActionInputs }, { request }],
    ),
    where: async (frames) => {
      // Query the verifyAdapter. If an error occurs, 'authError' will be bound in the frames.
      frames = await frames.query(verifyAdapter, { sessionToken: token }, { error: 'authError' as string });
      // Frames where verifyAdapter returned a user will not have 'authError' and will be filtered out here.
      return frames;
    },
    then: actions(
      // Respond to the original request with the authentication error.
      [Requesting.respond, { request, error: 'authError' as string }],
    ),
  });

  // 3. Action Success Response
  // This sync fires when the underlying HerdGrouping action/query completes successfully.
  const actionResponseSuccess: Sync = ({ request, ...actionOutputs }) => ({
    name: `${syncName}ResponseSuccess`,
    when: actions(
      // Match the original request flow by path and its unique ID.
      [Requesting.request, { path }, { request }],
      // Match successful action output. The inputs to actionFn are not re-matched here, only its successful output.
      [actionFn, {}, { ...actionOutputPattern }],
    ),
    then: actions(
      // Respond to the original request with the action's output.
      // If actionOutputPattern is empty, return a generic success status.
      [Requesting.respond, { request, ...(Object.keys(actionOutputPattern).length > 0 ? actionOutputs : { status: "success" }) }],
    ),
  });

  // 4. Action Error Response
  // This sync fires when the underlying HerdGrouping action/query returns an error.
  const actionResponseError: Sync = ({ request, error }) => ({
    name: `${syncName}ResponseError`,
    when: actions(
      // Match the original request flow by path and its unique ID.
      [Requesting.request, { path }, { request }],
      // Match action error output.
      [actionFn, {}, { error }],
    ),
    then: actions(
      // Respond to the original request with the error message.
      [Requesting.respond, { request, error }],
    ),
  });

  return [
    requestAuthenticated,
    requestAuthenticationError,
    actionResponseSuccess,
    actionResponseError,
  ];
};


// =====================================================================
// Specific Syncs for each HerdGrouping Action/Query
// These calls use the `withAuthentication` helper to generate the 4 required syncs.
// =====================================================================

// createHerd (user: User, name: String, description?: String): ({herdName: String} | {error: String})
export const CreateHerdSyncs = withAuthentication(
  "CreateHerd",
  "/HerdGrouping/createHerd",
  HerdGrouping.createHerd,
  ['name', 'description'],
  { herdName: 'herdName' },
);

// addAnimal (user: User, herdName: String, animal: Animal): Empty | {error: String}
export const AddAnimalSyncs = withAuthentication(
  "AddAnimal",
  "/HerdGrouping/addAnimal",
  HerdGrouping.addAnimal,
  ['herdName', 'animal'],
  {}, // Empty output for success
);

// removeAnimal (user: User, herdName: String, animal: Animal): Empty | {error: String}
export const RemoveAnimalSyncs = withAuthentication(
  "RemoveAnimal",
  "/HerdGrouping/removeAnimal",
  HerdGrouping.removeAnimal,
  ['herdName', 'animal'],
  {}, // Empty output for success
);

// moveAnimal (user: User, sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}
export const MoveAnimalSyncs = withAuthentication(
  "MoveAnimal",
  "/HerdGrouping/moveAnimal",
  HerdGrouping.moveAnimal,
  ['sourceHerdName', 'targetHerdName', 'animal'],
  {}, // Empty output for success
);

// mergeHerds (user: User, herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}
export const MergeHerdsSyncs = withAuthentication(
  "MergeHerds",
  "/HerdGrouping/mergeHerds",
  HerdGrouping.mergeHerds,
  ['herdNameToKeep', 'herdNameToArchive'],
  {}, // Empty output for success
);

// splitHerd (user: User, sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}
export const SplitHerdSyncs = withAuthentication(
  "SplitHerd",
  "/HerdGrouping/splitHerd",
  HerdGrouping.splitHerd,
  ['sourceHerdName', 'targetHerdName', 'animalsToMove'],
  {}, // Empty output for success
);

// deleteHerd (user: User, herdName: String): Empty | {error: String}
export const DeleteHerdSyncs = withAuthentication(
  "DeleteHerd",
  "/HerdGrouping/deleteHerd",
  HerdGrouping.deleteHerd,
  ['herdName'],
  {}, // Empty output for success
);

// restoreHerd (user: User, herdName: String): Empty | {error: String}
export const RestoreHerdSyncs = withAuthentication(
  "RestoreHerd",
  "/HerdGrouping/restoreHerd",
  HerdGrouping.restoreHerd,
  ['herdName'],
  {}, // Empty output for success
);

// _viewComposition (user: User, herdName: String): ({animals: Array<Animal>} | {error: String})
export const ViewCompositionSyncs = withAuthentication(
  "ViewComposition",
  "/HerdGrouping/_viewComposition",
  HerdGrouping._viewComposition,
  ['herdName'],
  { animals: 'animals' }, // Output for query
);

// _listActiveHerds (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
export const ListActiveHerdsSyncs = withAuthentication(
  "ListActiveHerds",
  "/HerdGrouping/_listActiveHerds",
  HerdGrouping._listActiveHerds,
  [], // No specific input parameters other than 'user' (handled by auth)
  { herds: 'herds' }, // Output for query
);

// _listArchivedHerds (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
export const ListArchivedHerdsSyncs = withAuthentication(
  "ListArchivedHerds",
  "/HerdGrouping/_listArchivedHerds",
  HerdGrouping._listArchivedHerds,
  [], // No specific input parameters other than 'user' (handled by auth)
  { herds: 'herds' }, // Output for query
);

// =====================================================================
// Export all syncs as a single array for easy loading into the engine
// =====================================================================

export const allHerdGroupingSyncs = [
  ...CreateHerdSyncs,
  ...AddAnimalSyncs,
  ...RemoveAnimalSyncs,
  ...MoveAnimalSyncs,
  ...MergeHerdsSyncs,
  ...SplitHerdSyncs,
  ...DeleteHerdSyncs,
  ...RestoreHerdSyncs,
  ...ViewCompositionSyncs,
  ...ListActiveHerdsSyncs,
  ...ListArchivedHerdsSyncs,
];
```
