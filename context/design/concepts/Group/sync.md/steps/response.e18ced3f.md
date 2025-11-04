---
timestamp: 'Sun Nov 02 2025 17:26:03 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_172603.09612673.md]]'
content_id: e18ced3feca2109bf34b17a0ddd5008a5a1c6c95e842379feee1821f34579934
---

# response:

The error message `Missing binding: Symbol(error) in frame: [object Object]` indicates that the synchronization engine tried to access a variable named `error` (represented by its Symbol) in a `frame` object, but that symbol was not bound to any value within that frame.

Let's trace the execution flow and the state of your `ViewCompositionRequest` sync:

1. **`ViewCompositionRequest.when` fires:** A `Requesting.request` for `/HerdGrouping/_viewComposition` is matched. The variables `request`, `token`, `herdName` are bound.

2. **First `frames.query(verifyAdapter, ...)`:**
   * Your logs show: `UserAuthentication.verify { token: '...' } => { user: 'Cal' }`.
   * The `verifyAdapter` receives this successful result.
   * It executes `if ("user" in result) { return [{ user: result.user as ID }]; }`.
   * So, `frames` after this step will look like `[{ [user]: 'Cal' }]`.
   * **Crucially, it does NOT bind `error` or `authError` to `undefined` or any other value in this successful path.**

3. **`frames = frames.filter(($) => $[user] !== undefined && $[authError] === undefined);`:**
   * The current frame is `[{ [user]: 'Cal' }]`.
   * `$[user] !== undefined` is `true`.
   * `$[authError] === undefined` is `true` (because `authError` was never bound in the frame).
   * The filter passes, and `frames` remains `[{ [user]: 'Cal' }]`.

4. **Second `frames.query(viewCompositionAdapter, ...)`:**
   * This is the critical part. You're passing `_viewCompositionAdapter` to `frames.query` with the output pattern `{ animals, error }`.
   * This tells the engine: "Call `viewCompositionAdapter`. Whatever it returns in its `animals` field, bind to *our* `animals` symbol. Whatever it returns in its `error` field, bind to *our* `error` symbol."
   * Let's look at `viewCompositionAdapter`:
     ```typescript
     const viewCompositionAdapter = async (
       { user, herdName }: { user: ID; herdName: string },
     ): Promise<({ animals: unknown[] } | { error: string })[]> => {
       const result = await HerdGrouping._viewComposition({ user, herdName });
       if ("error" in result) return [{ error: result.error }]; // <-- Binds 'error', NOT 'animals'
       return [{ animals: result.animals }]; // <-- Binds 'animals', NOT 'error'
     };
     ```
   * If `HerdGrouping._viewComposition` is successful (which is implied by your problem description where verification passes, and no error is reported from `HerdGrouping._viewComposition` itself), then `viewCompositionAdapter` returns `[{ animals: result.animals }]`.
   * When `frames.query` processes this:
     * It sees `animals` in the result, so `[animals]` is bound in the frame.
     * It *does not see `error` in the result*. **Therefore, `[error]` is NOT bound in the frame.**

5. **`then: actions([Requesting.respond, { request, animals, error }]),`:**
   * At this point, the `frame` contains `{[user]: 'Cal', [animals]: [...]}` but *does not contain `[error]`*.
   * The `Requesting.respond` action expects all listed variables (`request`, `animals`, `error`) to be present in the frame. Since `Symbol(error)` is completely absent (not even `undefined`), the engine throws the "Missing binding" error.

### Solution

The `viewCompositionAdapter` (and potentially other query adapters if they have `error` as a possible output) needs to ensure that **both** the successful data variable (`animals`) and the error variable (`error`) are *always* bound in the returned object, setting one to `undefined` if it's not applicable.

**Updated `viewCompositionAdapter`:**

```typescript
const viewCompositionAdapter = async (
  { user, herdName }: { user: ID; herdName: string },
): Promise<({ animals?: unknown[]; error?: string })[]> => { // <-- Updated return type to include optionality
  const result = await HerdGrouping._viewComposition({ user, herdName });
  if ("error" in result) {
    return [{ animals: undefined, error: result.error }]; // Explicitly bind animals as undefined
  }
  return [{ animals: result.animals, error: undefined }]; // Explicitly bind error as undefined
};
```

**Reasoning for the change:**
By explicitly returning `animals: undefined` when there's an error, and `error: undefined` when successful, the `frames.query` operation will ensure that the `[animals]` symbol and the `[error]` symbol are *always* present in the resulting frames, even if their value is `undefined`. This satisfies the engine's requirement that all variables used in the `then` clause are bound.

You would apply similar logic to any other query adapters that have success/error branches and whose results are collected with an output pattern that expects both. In your current syncs, `_listActiveHerds` and `_listArchivedHerds` don't have error returns in their concept spec queries, so their adapters are fine as they are.

This approach effectively consolidates the success and error handling for a query into a single `then` clause, with the client-side (or a subsequent sync) responsible for checking whether `animals` or `error` is defined in the response.
