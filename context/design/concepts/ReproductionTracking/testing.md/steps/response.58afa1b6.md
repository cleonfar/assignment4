---
timestamp: 'Thu Oct 16 2025 18:33:10 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_183310.a391e7cb.md]]'
content_id: 58afa1b61b19915b39ce96dc702a579697a4ee3d3890f99187f49fc483d9894b
---

# response:

This "Leaks detected" error indicates that some asynchronous resource (like a network connection to MongoDB, in this case, a TLS connection) was opened during the test but was not cleanly closed by the time the test finished. The `op_read` part refers to a pending read operation on that connection.

While your test code structure with `const [db, client] = await testDb();` and `await client.close();` at the end of each top-level `Deno.test` block is the correct and standard way to manage database connections in Deno tests, this error suggests that `client.close()` might not be fully resolving all underlying network operations *immediately* before Deno's leak detector runs.

Here's why this might happen and what you can investigate:

1. **Timing/Race Condition:** Sometimes, there's a very small window where Deno's runtime checks for leaks right after `client.close()` is awaited, but before all underlying OS-level network resources have completely torn down. This is more common with network-intensive operations like database connections.

2. **`testDb()` Implementation Details:** The most common source of such persistent leaks, even with `client.close()`, is if the `testDb()` utility itself has some shared or lingering resources, or if `client.close()` doesn't fully shut down everything for the specific MongoDB client instance it manages. For example:
   * If `testDb()` uses a global connection pool that `client.close()` doesn't completely drain or dispose of.
   * If `testDb()` creates a client but doesn't fully await all its internal initialization.

3. **MongoDB Driver or Deno Runtime Bug:** Less likely, but possible, is a subtle interaction bug between the specific version of Deno, the MongoDB driver, or even the underlying operating system.

**What you should do (and why your current code is mostly okay):**

Your current test code for the `addMother` action (and others using the `[db, client] = await testDb()` pattern) correctly places `await client.close()` at the end of the top-level `Deno.test` block. This is exactly where it should be to ensure resources opened *within that specific test context* are closed.

Since the error points specifically to the `addMother action` test, and that test appears to correctly `await` all `concept` methods, the problem is unlikely to be an unawaited promise *in your test logic*.

**Recommended Investigation:**

1. **Run with `--trace-leaks`:** As Deno suggests, run your tests with `deno test --trace-leaks ./src/concepts/ReproductionTracking/ReproductionTrackingConcept.test.ts`. This might provide more specific information about *where* the `op_read` was initiated, which could point to an internal part of the MongoDB driver or `testDb()`.

2. **Verify `testDb()`:** If you have access to the `@utils/database.ts` file, closely examine how `getDb` and `testDb` are implemented.
   * Does `testDb()` always create a *new*, isolated `MongoClient` instance for each test?
   * Are there any global variables or caches related to the MongoDB client that might persist across test runs or even across different `testDb()` calls within the same run?
   * Ensure that `testDb()` (or `getDb` if `testDb` just wraps it) is solely responsible for creating and returning the `MongoClient`, and that nothing else maintains a reference or implicitly reuses a connection that `client.close()` is trying to shut down.

3. **Consider an `afterAll` hook (less likely for your current structure):** If `testDb()` were initializing a *single* client for the *entire file*, then `Deno.test.afterAll` would be the place for `client.close()`. However, your current structure with `await client.close()` in *each* `Deno.test` block correctly implies a per-test client.

**No changes are needed to the test code itself, as its structure for resource management is correct.** The issue is likely in the environment setup or the `testDb` utility.

```typescript
// All test cases are already structured correctly with `await client.close()`
// at the end of each top-level Deno.test block.
// The "Leaks detected" error suggests an issue external to the provided test code,
// likely within the `testDb()` utility's implementation or a timing issue with Deno/MongoDB driver.
// No code changes are proposed for the test file itself.
```
