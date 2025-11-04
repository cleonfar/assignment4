---
timestamp: 'Mon Nov 03 2025 19:26:33 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_192633.7fbdc20c.md]]'
content_id: 5b0b33babaead5f9c3859e629bbbba41d57c04aa509d9df274eb0d0f9d24100d
---

# response:

```typescript
// src/syncs/reproductionTracking.sync.ts

import { ID, Empty } from "@utils/types.ts";
import { actions, Sync, Frames } from "@engine";
import { Requesting } from "@concepts"; // Requesting is a core concept

// Import the ReproductionTracking concept and UserAuthentication concept
import ReproductionTrackingConcept from "@concepts/ReproductionTracking/ReproductionTrackingConcept.ts";
import UserAuthenticationConcept from "@concepts/UserAuthentication/UserAuthenticationConcept.ts";

// Define aliases for the concepts for cleaner use in syncs
// The database instance will be injected by the engine at runtime.
const ReproductionTracking = new ReproductionTrackingConcept({} as any);
const UserAuthentication = new UserAuthenticationConcept({} as any);

// Re-export types from the concept for use within syncs if needed, or define locally as patterns
type UserId = ID;

// === ADAPTER for UserAuthentication.verify ===
// This adapter translates the output of UserAuthentication.verify into a format
// that can be easily used within the `where` clause of a sync.
const verifyAdapter = async (
  { sessionToken }: { sessionToken: string },
): Promise<({ user: UserId } | { error: string })[]> => {
  const result = await UserAuthentication.verify({ token: sessionToken });
  if ("user" in result) {
    return [{ user: result.user as UserId }];
  }
  if ("error" in result) {
    return [{ error: result.error }];
  }
  return []; // Should not be reached in a robust implementation of UserAuthentication.verify
};

// =========================================================================
// Syncs for ReproductionTracking Actions
// Each action typically has four associated syncs:
// 1. _Request_AuthSuccess: Handles the incoming request, authenticates, and calls the concept action upon success.
// 2. _Request_AuthFailure: Handles the incoming request, authenticates, and responds with an error upon failure.
// 3. _Response_Success: Catches the successful outcome of the concept action and responds to the original request.
// 4. _Response_ConceptError: Catches the error outcome of the concept action and responds to the original request.
// =========================================================================

// --- addMother (userId: String, motherId: String): (motherId: String) ---

// Trigger: Requesting to addMother, authenticate user, then call addMother action
export const AddMother_Request_AuthSuccess: Sync = (
  { request, sessionToken, motherId, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/addMother", sessionToken, motherId },
    { request }, // Capture the original request ID
  ]),
  where: async (frames) => {
    // Authenticate user by calling the verifyAdapter
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]); // Only proceed if authentication succeeded (userId is bound)
  },
  then: actions([
    ReproductionTracking.addMother,
    { userId, motherId },
    { motherId: resultMotherId, error: conceptError }, // Capture concept action's output
  ]),
});

// Response: Authentication Failure for addMother
export const AddMother_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/addMother", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    // Authenticate user to get the specific authentication error reason
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]); // Only proceed if authentication failed (authError is bound)
  },
  then: actions([
    Requesting.respond,
    { request, error: authError }, // Respond to the original request with the auth error
  ]),
});

// Response: Success for addMother
export const AddMother_Response_Success: Sync = (
  { request, resultMotherId },
) => ({
  when: actions([
    Requesting.request, // Match the original request
    { path: "/ReproductionTracking/addMother" },
    { request },
  ]),
  where: (frames) => {
    // Match the successful outcome of the ReproductionTracking.addMother action associated with this request
    return frames.query(ReproductionTracking.addMother, {}, { motherId: resultMotherId });
  },
  then: actions([
    Requesting.respond,
    { request, motherId: resultMotherId }, // Respond with the successful result
  ]),
});

// Response: Concept Error for addMother
export const AddMother_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/addMother" },
    { request },
  ]),
  where: (frames) => {
    // Match the error outcome of the ReproductionTracking.addMother action
    return frames.query(ReproductionTracking.addMother, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError }, // Respond with the concept-specific error
  ]),
});

// --- removeMother (userId: String, motherId: String): (motherId: String) ---

export const RemoveMother_Request_AuthSuccess: Sync = (
  { request, sessionToken, motherId, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/removeMother", sessionToken, motherId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.removeMother,
    { userId, motherId },
    { motherId: resultMotherId, error: conceptError },
  ]),
});

export const RemoveMother_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/removeMother", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const RemoveMother_Response_Success: Sync = (
  { request, resultMotherId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/removeMother" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.removeMother, {}, { motherId: resultMotherId });
  },
  then: actions([
    Requesting.respond,
    { request, motherId: resultMotherId },
  ]),
});

export const RemoveMother_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/removeMother" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.removeMother, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- recordLitter (userId: String, motherId: String, fatherId: String?, birthDate: Date, reportedLitterSize: Number, notes: String?): (litterID: String) ---

export const RecordLitter_Request_AuthSuccess: Sync = (
  { request, sessionToken, motherId, fatherId, birthDate, reportedLitterSize, notes, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordLitter", sessionToken, motherId, fatherId, birthDate, reportedLitterSize, notes },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.recordLitter,
    { userId, motherId, fatherId, birthDate, reportedLitterSize, notes },
    { litterID: resultLitterID, error: conceptError },
  ]),
});

export const RecordLitter_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordLitter", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const RecordLitter_Response_Success: Sync = (
  { request, resultLitterID },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordLitter" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.recordLitter, {}, { litterID: resultLitterID });
  },
  then: actions([
    Requesting.respond,
    { request, litterID: resultLitterID },
  ]),
});

export const RecordLitter_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordLitter" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.recordLitter, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- updateLitter (userId: String, litterId: String, motherId: String?, fatherId: String?, birthDate: Date?, reportedLitterSize: Number?, notes: String?): (litterID: String) ---

export const UpdateLitter_Request_AuthSuccess: Sync = (
  { request, sessionToken, litterId, motherId, fatherId, birthDate, reportedLitterSize, notes, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateLitter", sessionToken, litterId, motherId, fatherId, birthDate, reportedLitterSize, notes },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.updateLitter,
    { userId, litterId, motherId, fatherId, birthDate, reportedLitterSize, notes },
    { litterID: resultLitterID, error: conceptError },
  ]),
});

export const UpdateLitter_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateLitter", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const UpdateLitter_Response_Success: Sync = (
  { request, resultLitterID },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateLitter" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.updateLitter, {}, { litterID: resultLitterID });
  },
  then: actions([
    Requesting.respond,
    { request, litterID: resultLitterID },
  ]),
});

export const UpdateLitter_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateLitter" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.updateLitter, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- recordOffspring (userId: String, litterId: String, offspringId: String, sex: Enum [male, female, neutered], notes: String?): (offspringID: String) ---

export const RecordOffspring_Request_AuthSuccess: Sync = (
  { request, sessionToken, litterId, offspringId, sex, notes, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordOffspring", sessionToken, litterId, offspringId, sex, notes },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.recordOffspring,
    { userId, litterId, offspringId, sex, notes },
    { offspringID: resultOffspringID, error: conceptError },
  ]),
});

export const RecordOffspring_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordOffspring", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const RecordOffspring_Response_Success: Sync = (
  { request, resultOffspringID },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordOffspring" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.recordOffspring, {}, { offspringID: resultOffspringID });
  },
  then: actions([
    Requesting.respond,
    { request, offspringID: resultOffspringID },
  ]),
});

export const RecordOffspring_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordOffspring" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.recordOffspring, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- updateOffspring (userId: String, oldOffspringId: String, newOffspringId: String?, litterId: String?, sex: Enum?, notes: String?): (offspringID: String) ---

export const UpdateOffspring_Request_AuthSuccess: Sync = (
  { request, sessionToken, oldOffspringId, newOffspringId, litterId, sex, notes, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateOffspring", sessionToken, oldOffspringId, newOffspringId, litterId, sex, notes },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.updateOffspring,
    { userId, oldOffspringId, newOffspringId, litterId, sex, notes },
    { offspringID: resultOffspringID, error: conceptError },
  ]),
});

export const UpdateOffspring_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateOffspring", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const UpdateOffspring_Response_Success: Sync = (
  { request, resultOffspringID },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateOffspring" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.updateOffspring, {}, { offspringID: resultOffspringID });
  },
  then: actions([
    Requesting.respond,
    { request, offspringID: resultOffspringID },
  ]),
});

export const UpdateOffspring_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateOffspring" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.updateOffspring, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- recordWeaning (userId: String, offspringId: String): (offspringID: String) ---

export const RecordWeaning_Request_AuthSuccess: Sync = (
  { request, sessionToken, offspringId, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordWeaning", sessionToken, offspringId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.recordWeaning,
    { userId, offspringId },
    { offspringID: resultOffspringID, error: conceptError },
  ]),
});

export const RecordWeaning_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordWeaning", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const RecordWeaning_Response_Success: Sync = (
  { request, resultOffspringID },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordWeaning" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.recordWeaning, {}, { offspringID: resultOffspringID });
  },
  then: actions([
    Requesting.respond,
    { request, offspringID: resultOffspringID },
  ]),
});

export const RecordWeaning_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordWeaning" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.recordWeaning, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- recordDeath (userId: String, offspringId: String): (offspringId: String) ---

export const RecordDeath_Request_AuthSuccess: Sync = (
  { request, sessionToken, offspringId, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordDeath", sessionToken, offspringId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.recordDeath,
    { userId, offspringId },
    { offspringId: resultOffspringId, error: conceptError },
  ]),
});

export const RecordDeath_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordDeath", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const RecordDeath_Response_Success: Sync = (
  { request, resultOffspringId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordDeath" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.recordDeath, {}, { offspringId: resultOffspringId });
  },
  then: actions([
    Requesting.respond,
    { request, offspringId: resultOffspringId },
  ]),
});

export const RecordDeath_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordDeath" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.recordDeath, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- generateReport (userId: String, target: String, startDateRange: Date, endDateRange: Date, name: String): (results: string[]) ---

export const GenerateReport_Request_AuthSuccess: Sync = (
  { request, sessionToken, target, startDateRange, endDateRange, name, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/generateReport", sessionToken, target, startDateRange, endDateRange, name },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.generateReport,
    { userId, target, startDateRange, endDateRange, name },
    { results: reportResults, error: conceptError },
  ]),
});

export const GenerateReport_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/generateReport", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const GenerateReport_Response_Success: Sync = (
  { request, reportResults },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/generateReport" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.generateReport, {}, { results: reportResults });
  },
  then: actions([
    Requesting.respond,
    { request, results: reportResults },
  ]),
});

export const GenerateReport_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/generateReport" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.generateReport, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- renameReport (userId: String, oldName: String, newName: String): (newName: String) ---

export const RenameReport_Request_AuthSuccess: Sync = (
  { request, sessionToken, oldName, newName, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/renameReport", sessionToken, oldName, newName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.renameReport,
    { userId, oldName, newName },
    { newName: resultNewName, error: conceptError },
  ]),
});

export const RenameReport_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/renameReport", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const RenameReport_Response_Success: Sync = (
  { request, resultNewName },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/renameReport" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.renameReport, {}, { newName: resultNewName });
  },
  then: actions([
    Requesting.respond,
    { request, newName: resultNewName },
  ]),
});

export const RenameReport_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/renameReport" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.renameReport, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- deleteReport (userId: String, reportName: String): Empty ---

export const DeleteReport_Request_AuthSuccess: Sync = (
  { request, sessionToken, reportName, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/deleteReport", sessionToken, reportName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.deleteReport,
    { userId, reportName },
    { error: conceptError }, // deleteReport returns Empty on success, or {error}
  ]),
});

export const DeleteReport_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/deleteReport", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const DeleteReport_Response_Success: Sync = (
  { request }, // deleteReport success returns Empty, so no specific result variable here
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/deleteReport" },
    { request },
  ]),
  where: (frames) => {
    // We expect an empty object for success, so we match on a lack of 'error'
    return frames.query(ReproductionTracking.deleteReport, {}, {}); // Empty object matches success (no error field)
  },
  then: actions([
    Requesting.respond,
    { request }, // Respond with empty object for success
  ]),
});

export const DeleteReport_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/deleteReport" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.deleteReport, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- regenerateAISummary (userId: String, reportName: String): (summary: String) ---

export const RegenerateAISummary_Request_AuthSuccess: Sync = (
  { request, sessionToken, reportName, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/regenerateAISummary", sessionToken, reportName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking.regenerateAISummary,
    { userId, reportName },
    { summary: resultSummary, error: conceptError },
  ]),
});

export const RegenerateAISummary_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/regenerateAISummary", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const RegenerateAISummary_Response_Success: Sync = (
  { request, resultSummary },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/regenerateAISummary" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.regenerateAISummary, {}, { summary: resultSummary });
  },
  then: actions([
    Requesting.respond,
    { request, summary: resultSummary },
  ]),
});

export const RegenerateAISummary_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/regenerateAISummary" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking.regenerateAISummary, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});


// =========================================================================
// Syncs for ReproductionTracking Queries
// Queries generally return an array of objects or a single object.
// The pattern remains largely the same, but the 'then' clauses for success
// will pass the query's output directly to Requesting.respond.
// =========================================================================

// --- _viewReport (userId: String, reportName: String): (results: String) ---

export const ViewReport_Request_AuthSuccess: Sync = (
  { request, sessionToken, reportName, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport", sessionToken, reportName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking._viewReport,
    { userId, reportName },
    { results: reportResults, error: conceptError },
  ]),
});

export const ViewReport_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const ViewReport_Response_Success: Sync = (
  { request, reportResults },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._viewReport, {}, { results: reportResults });
  },
  then: actions([
    Requesting.respond,
    { request, results: reportResults }, // Respond with the query results
  ]),
});

export const ViewReport_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._viewReport, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});


// --- _listMothers (userId: String): (mother: Mother) ---

export const ListMothers_Request_AuthSuccess: Sync = (
  { request, sessionToken, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking._listMothers,
    { userId },
    { mother: mothersList, error: conceptError }, // Query returns { mother: Mother[] }
  ]),
});

export const ListMothers_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const ListMothers_Response_Success: Sync = (
  { request, mothersList },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._listMothers, {}, { mother: mothersList });
  },
  then: actions([
    Requesting.respond,
    { request, mother: mothersList }, // Respond with the list of mothers
  ]),
});

export const ListMothers_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._listMothers, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- _listLittersByMother (userId: String, motherId: String): (litter: Litter) ---

export const ListLittersByMother_Request_AuthSuccess: Sync = (
  { request, sessionToken, motherId, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother", sessionToken, motherId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking._listLittersByMother,
    { userId, motherId },
    { litter: littersList, error: conceptError },
  ]),
});

export const ListLittersByMother_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const ListLittersByMother_Response_Success: Sync = (
  { request, littersList },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._listLittersByMother, {}, { litter: littersList });
  },
  then: actions([
    Requesting.respond,
    { request, litter: littersList },
  ]),
});

export const ListLittersByMother_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._listLittersByMother, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- _listOffspringByLitter (userId: String, litterId: String): (offspring: Offspring) ---

export const ListOffspringByLitter_Request_AuthSuccess: Sync = (
  { request, sessionToken, litterId, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter", sessionToken, litterId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking._listOffspringByLitter,
    { userId, litterId },
    { offspring: offspringList, error: conceptError },
  ]),
});

export const ListOffspringByLitter_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const ListOffspringByLitter_Response_Success: Sync = (
  { request, offspringList },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._listOffspringByLitter, {}, { offspring: offspringList });
  },
  then: actions([
    Requesting.respond,
    { request, offspring: offspringList },
  ]),
});

export const ListOffspringByLitter_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._listOffspringByLitter, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});

// --- _aiSummary (userId: String, reportName: String): (summary: String) ---

export const AISummary_Request_AuthSuccess: Sync = (
  { request, sessionToken, reportName, user: userId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary", sessionToken, reportName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: userId });
    return frames.filter(($) => $[userId]);
  },
  then: actions([
    ReproductionTracking._aiSummary,
    { userId, reportName },
    { summary: resultSummary, error: conceptError },
  ]),
});

export const AISummary_Request_AuthFailure: Sync = (
  { request, sessionToken, error: authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary", sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

export const AISummary_Response_Success: Sync = (
  { request, resultSummary },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._aiSummary, {}, { summary: resultSummary });
  },
  then: actions([
    Requesting.respond,
    { request, summary: resultSummary },
  ]),
});

export const AISummary_Response_ConceptError: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary" },
    { request },
  ]),
  where: (frames) => {
    return frames.query(ReproductionTracking._aiSummary, {}, { error: conceptError });
  },
  then: actions([
    Requesting.respond,
    { request, error: conceptError },
  ]),
});
```
