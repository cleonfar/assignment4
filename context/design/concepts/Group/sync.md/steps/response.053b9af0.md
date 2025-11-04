---
timestamp: 'Sun Nov 02 2025 17:54:57 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_175457.2e3a650d.md]]'
content_id: 053b9af05e5d0dcf4123bcd26b06ea7c344b80b1da6fd6bd2668aec278f3632b
---

# response:

The error message `Missing binding: Symbol(error) in frame: [object Object]` indicates that the symbol `error` is being accessed in a frame where it hasn't been bound. This happens within your `_viewComposition` sync (and potentially other query syncs) when `HerdGrouping._viewComposition` is successful.

Let's break down the flow in `ViewCompositionRequest`:

1. **Authentication:** `frames.query(verifyAdapter, ..., { user, error: authError })`
   * If successful, `user` is bound. `authError` is *not* bound.
   * The filter `frames.filter(($) => $[user] !== undefined && $[authError] === undefined)` keeps these successful frames.
2. **Query Execution:** `frames = await frames.query(viewCompositionAdapter, { user, herdName }, { animals, error });`
   * This calls `viewCompositionAdapter`.
   * If `HerdGrouping._viewComposition` is successful, `viewCompositionAdapter` returns `[{ animals: [...] }]`.
   * When `frames.query` processes this result with the output pattern `{ animals, error }`:
     * `animals` is bound correctly from `result.animals`.
     * `error` is **not bound**, because the adapter didn't return an `error` property in the successful case.
3. **Problematic `map` (from previous versions of the code, but the same logic applies to where the error is detected):** `frames = frames.map(($) => ({ ...$, [animals]: $[animals], [error]: $[error], }));`
   * This line attempts to access `$[error]`. Since the `error` symbol was not bound by `frames.query` in the successful path, trying to access `$[error]` results in the "Missing binding" error.

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
