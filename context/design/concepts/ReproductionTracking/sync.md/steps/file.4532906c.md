---
timestamp: 'Mon Nov 03 2025 18:47:06 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_184706.675c45fd.md]]'
content_id: 4532906ca22bc22cf5ba97402f897f7636281878ccd80638e0f65dd40b8dd9c0
---

# file: src/syncs/growth\_tracking.sync.ts

```typescript
import { actions, Sync, Frames } from "@engine";
import { Requesting } from "@concepts"; // Assuming Requesting is available
import GrowthTrackingConcept from "@concepts/GrowthTracking/GrowthTrackingConcept.ts";
import UserAuthenticationConcept from "@concepts/UserAuthentication/UserAuthenticationConcept.ts";
import { ID } from "@utils/types.ts";

// Instantiate concepts (in a real engine, these would be managed)
// For this example, we need to mock or properly inject them.
// If running in the actual Concept Engine, you import them from @concepts and they are ready.
const GrowthTracking = {} as GrowthTrackingConcept; // Mock for type inference
const UserAuthentication = {} as UserAuthenticationConcept; // Mock for type inference

// ADAPTER: User verification
// This adapter takes a Frame and extracts the sessionToken to call UserAuthentication.verify
// It then enriches the frame with either the 'user' ID or an 'error' message.
const verifyAdapter = async (
  frames: Frames,
  { sessionToken }: { sessionToken: string },
): Promise<Frames> => {
  // In a real application, UserAuthentication would be an injected dependency or globally accessible concept instance.
  // For this example, we'll assume `UserAuthentication` refers to an instance in scope.
  const result = await UserAuthentication.verify({ token: sessionToken });

  if ("user" in result) {
    return frames.map((frame) => ({ ...frame, user: result.user as ID }));
  } else if ("error" in result) {
    return frames.map((frame) => ({ ...frame, error: result.error }));
  }
  return new Frames(); // Should not typically be reached if verify always returns user or error
};

// --- Action Syncs for GrowthTrackingConcept ---

// 1. addGrowthRecord

export const AddGrowthRecordRequest: Sync = ({
  request,
  sessionToken,
  animalId,
  date,
  weight,
  notes,
  user, // Variable to be bound by verifyAdapter
  error, // Variable to be bound by verifyAdapter on error
}) => ({
  when: actions([
    Requesting.request,
    { path: "/GrowthTracking/addGrowthRecord", sessionToken, animalId, date, weight, notes },
    { request },
  ]),
  where: async (frames) => {
    // Authenticate the user
    frames = await verifyAdapter(frames, { sessionToken });
    // Filter out frames where authentication failed
    return frames.filter(($) => $[user] !== undefined);
  },
  then: actions([
    GrowthTracking.addGrowthRecord,
    { userId: user, animalId, date, weight, notes },
  ]),
});

export const AddGrowthRecordResponseSuccess: Sync = ({
  request,
  recordId,
}) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/addGrowthRecord" }, { request }],
    [GrowthTracking.addGrowthRecord, {}, { recordId }],
  ),
  then: actions([
    Requesting.respond,
    { request, recordId },
  ]),
});

export const AddGrowthRecordResponseError: Sync = ({
  request,
  error,
}) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/addGrowthRecord" }, { request }],
    [GrowthTracking.addGrowthRecord, {}, { error }], // Catch error from GrowthTracking.addGrowthRecord
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const AddGrowthRecordAuthErrorResponse: Sync = ({
  request,
  sessionToken, // Match the sessionToken from the original request
  error, // Error from verifyAdapter
}) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/addGrowthRecord", sessionToken }, { request }],
  ),
  where: async (frames) => {
    // Re-run verifyAdapter to explicitly get the error message and filter for it
    frames = await verifyAdapter(frames, { sessionToken: frames[0]?.[sessionToken] });
    return frames.filter(($) => $[error] !== undefined); // Filter only frames with auth error
  },
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});


// 2. updateGrowthRecord

export const UpdateGrowthRecordRequest: Sync = ({
  request,
  sessionToken,
  recordId,
  newAnimalId,
  newDate,
  newWeight,
  newNotes,
  user,
  error,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/GrowthTracking/updateGrowthRecord", sessionToken, recordId, newAnimalId, newDate, newWeight, newNotes },
    { request },
  ]),
  where: async (frames) => {
    frames = await verifyAdapter(frames, { sessionToken });
    return frames.filter(($) => $[user] !== undefined);
  },
  then: actions([
    GrowthTracking.updateGrowthRecord,
    {
      userId: user,
      recordId,
      newAnimalId,
      newDate,
      newWeight,
      newNotes,
    },
  ]),
});

export const UpdateGrowthRecordResponseSuccess: Sync = ({
  request,
  recordId,
}) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/updateGrowthRecord" }, { request }],
    [GrowthTracking.updateGrowthRecord, {}, { recordId }],
  ),
  then: actions([
    Requesting.respond,
    { request, recordId },
  ]),
});

export const UpdateGrowthRecordResponseError: Sync = ({
  request,
  error,
}) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/updateGrowthRecord" }, { request }],
    [GrowthTracking.updateGrowthRecord, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const UpdateGrowthRecordAuthErrorResponse: Sync = ({
  request,
  sessionToken,
  error,
}) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/updateGrowthRecord", sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await verifyAdapter(frames, { sessionToken: frames[0]?.[sessionToken] });
    return frames.filter(($) => $[error] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});


// 3. deleteGrowthRecord

export const DeleteGrowthRecordRequest: Sync = ({
  request,
  sessionToken,
  recordId,
  user,
  error,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/GrowthTracking/deleteGrowthRecord", sessionToken, recordId },
    { request },
  ]),
  where: async (frames) => {
    frames = await verifyAdapter(frames, { sessionToken });
    return frames.filter(($) => $[user] !== undefined);
  },
  then: actions([
    GrowthTracking.deleteGrowthRecord,
    { userId: user, recordId },
  ]),
});

export const DeleteGrowthRecordResponseSuccess: Sync = ({
  request,
}) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/deleteGrowthRecord" }, { request }],
    [GrowthTracking.deleteGrowthRecord, {}, {}], // Empty result for success
  ),
  then: actions([
    Requesting.respond,
    { request, status: "success" }, // Explicit success message
  ]),
});

export const DeleteGrowthRecordResponseError: Sync = ({
  request,
  error,
}) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/deleteGrowthRecord" }, { request }],
    [GrowthTracking.deleteGrowthRecord, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const DeleteGrowthRecordAuthErrorResponse: Sync = ({
  request,
  sessionToken,
  error,
}) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/deleteGrowthRecord", sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await verifyAdapter(frames, { sessionToken: frames[0]?.[sessionToken] });
    return frames.filter(($) => $[error] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});


// --- Query Syncs for GrowthTrackingConcept (Combined success/error response) ---

// 4. _listGrowthRecordsByAnimal
export const ListGrowthRecordsByAnimalCombined: Sync = ({
  request,
  sessionToken,
  animalId,
  user, // Bound by verifyAdapter
  error, // Bound by verifyAdapter or query itself
  record, // Individual query result items
  results, // Collected query results
}) => ({
  when: actions([
    Requesting.request,
    { path: "/GrowthTracking/listGrowthRecordsByAnimal", sessionToken, animalId },
    { request },
  ]),
  where: async (frames) => {
    let currentFrames = frames; // Start with the initial request frame

    // 1. Authenticate user
    const authFrames = await verifyAdapter(currentFrames, { sessionToken: currentFrames[0]?.[sessionToken] });
    const userFrame = authFrames.find(($) => $[user] !== undefined); // Find the frame where user was successfully bound

    if (!userFrame) {
      // Authentication failed. Extract error from authFrames.
      const authError = authFrames[0]?.[error] || "Authentication failed.";
      return new Frames({ request: currentFrames[0][request], error: authError });
    }

    // Update currentFrames to only include the authenticated user (typically one frame)
    currentFrames = new Frames(userFrame);

    // 2. Execute the GrowthTracking query
    const queryResults = await currentFrames.query(
      GrowthTracking._listGrowthRecordsByAnimal,
      { userId: userFrame[user], animalId },
      { record },
    );

    // Check for query-specific errors
    const queryErrorFrame = queryResults.find(($) => $[error] !== undefined);
    if (queryErrorFrame) {
      return new Frames({ request: currentFrames[0][request], error: queryErrorFrame[error] });
    }

    // 3. Collect results if successful, otherwise pass through empty results
    if (queryResults.length > 0) {
      return queryResults.collectAs([record], results);
    } else {
      // No records found, respond with empty array for results
      return new Frames({ request: currentFrames[0][request], [results]: [] });
    }
  },
  then: actions([
    Requesting.respond,
    { request, results, error }, // 'results' will be present on success, 'error' on failure
  ]),
});


// 5. _getLatestGrowthRecord
export const GetLatestGrowthRecordCombined: Sync = ({
  request,
  sessionToken,
  animalId,
  user,
  error,
  record, // Single record result
}) => ({
  when: actions([
    Requesting.request,
    { path: "/GrowthTracking/getLatestGrowthRecord", sessionToken, animalId },
    { request },
  ]),
  where: async (frames) => {
    let currentFrames = frames;

    // 1. Authenticate user
    const authFrames = await verifyAdapter(currentFrames, { sessionToken: currentFrames[0]?.[sessionToken] });
    const userFrame = authFrames.find(($) => $[user] !== undefined);

    if (!userFrame) {
      const authError = authFrames[0]?.[error] || "Authentication failed.";
      return new Frames({ request: currentFrames[0][request], error: authError });
    }
    currentFrames = new Frames(userFrame);

    // 2. Execute the GrowthTracking query
    const queryResults = await currentFrames.query(
      GrowthTracking._getLatestGrowthRecord,
      { userId: userFrame[user], animalId },
      { record },
    );

    // Check for query-specific errors (e.g., no records found)
    const queryErrorFrame = queryResults.find(($) => $[error] !== undefined);
    if (queryErrorFrame) {
      return new Frames({ request: currentFrames[0][request], error: queryErrorFrame[error] });
    }

    // 3. Return the single record, or an error if the query found none.
    // The query itself is expected to return an error if no record is found.
    // If it returns an empty array, it means no record.
    if (queryResults.length > 0) {
        return new Frames({ request: currentFrames[0][request], record: queryResults[0][record] });
    } else {
        return new Frames({ request: currentFrames[0][request], error: "No latest record found." });
    }
  },
  then: actions([
    Requesting.respond,
    { request, record, error },
  ]),
});
```
