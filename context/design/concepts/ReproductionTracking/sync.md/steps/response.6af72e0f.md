---
timestamp: 'Mon Nov 03 2025 19:00:48 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_190048.1f7b550a.md]]'
content_id: 6af72e0f2841a8a3dc5bbef0df202ddac5d92c678350f5bd161f8e75e7c1be46
---

# response:

```typescript
// src/syncs/reproduction_tracking.sync.ts
import { actions, Sync, Frames } from "@engine";
import { Requesting, UserAuthentication } from "@concepts"; // Assuming UserAuthentication is in @concepts
import ReproductionTrackingConcept from "@concepts/ReproductionTracking/ReproductionTrackingConcept.ts"; // Explicit import

// --- Utility types for clarity ---
type UserId = ID;
type MotherId = ID;
type LitterId = ID;
type OffspringId = ID;
type ReportName = string;
type SessionToken = ID; // Assuming token is an ID as per UserAuthentication concept

// --- Verify Adapter (as provided by the user) ---
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
  return [];
};

// --- Helper for generating paths ---
const makePath = (actionName: string) => `/ReproductionTracking/${actionName}`;

// --- START SYNCHRONIZATIONS ---

// --------------------------------------------------------------------------------
// 1. addMother (userId: String, motherId: String): (motherId: String)
// --------------------------------------------------------------------------------

export const AddMotherRequest: Sync = (
  { request, sessionToken, motherId, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("addMother"), sessionToken, motherId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]); // Only pass through successful authentications
  },
  then: actions([
    ReproductionTrackingConcept.addMother,
    { userId: user, motherId },
  ]),
});

export const AddMotherResponseSuccess: Sync = (
  { request, motherId },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("addMother") }, { request }],
    [ReproductionTrackingConcept.addMother, {}, { motherId }],
  ),
  then: actions([
    Requesting.respond,
    { request, motherId },
  ]),
});

export const AddMotherResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("addMother") }, { request }],
    [ReproductionTrackingConcept.addMother, {}, { error }], // Action's error output
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const AddMotherResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("addMother"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    // Filter for frames where verification failed
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 2. removeMother (userId: String, motherId: String): (motherId: String)
// --------------------------------------------------------------------------------

export const RemoveMotherRequest: Sync = (
  { request, sessionToken, motherId, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("removeMother"), sessionToken, motherId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.removeMother,
    { userId: user, motherId },
  ]),
});

export const RemoveMotherResponseSuccess: Sync = (
  { request, motherId },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("removeMother") }, { request }],
    [ReproductionTrackingConcept.removeMother, {}, { motherId }],
  ),
  then: actions([
    Requesting.respond,
    { request, motherId },
  ]),
});

export const RemoveMotherResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("removeMother") }, { request }],
    [ReproductionTrackingConcept.removeMother, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const RemoveMotherResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("removeMother"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 3. recordLitter (userId: String, motherId: String, fatherId: String?, birthDate: Date, reportedLitterSize: Number, notes: String?): (litterID: String)
// --------------------------------------------------------------------------------

export const RecordLitterRequest: Sync = (
  { request, sessionToken, motherId, fatherId, birthDate, reportedLitterSize, notes, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("recordLitter"), sessionToken, motherId, fatherId, birthDate, reportedLitterSize, notes },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.recordLitter,
    { userId: user, motherId, fatherId, birthDate, reportedLitterSize, notes },
  ]),
});

export const RecordLitterResponseSuccess: Sync = (
  { request, litterID },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordLitter") }, { request }],
    [ReproductionTrackingConcept.recordLitter, {}, { litterID }],
  ),
  then: actions([
    Requesting.respond,
    { request, litterID },
  ]),
});

export const RecordLitterResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordLitter") }, { request }],
    [ReproductionTrackingConcept.recordLitter, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const RecordLitterResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordLitter"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 4. updateLitter (userId: String, litterId: String, motherId: String?, fatherId: String?, birthDate: Date?, reportedLitterSize: Number?, notes: String?): (litterID: String)
// --------------------------------------------------------------------------------

export const UpdateLitterRequest: Sync = (
  { request, sessionToken, litterId, motherId, fatherId, birthDate, reportedLitterSize, notes, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("updateLitter"), sessionToken, litterId, motherId, fatherId, birthDate, reportedLitterSize, notes },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.updateLitter,
    { userId: user, litterId, motherId, fatherId, birthDate, reportedLitterSize, notes },
  ]),
});

export const UpdateLitterResponseSuccess: Sync = (
  { request, litterID },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("updateLitter") }, { request }],
    [ReproductionTrackingConcept.updateLitter, {}, { litterID }],
  ),
  then: actions([
    Requesting.respond,
    { request, litterID },
  ]),
});

export const UpdateLitterResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("updateLitter") }, { request }],
    [ReproductionTrackingConcept.updateLitter, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const UpdateLitterResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("updateLitter"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 5. recordOffspring (userId: String, litterId: String, offspringId: String, sex: Enum [male, female, neutered], notes: String?): (offspringID: String)
// --------------------------------------------------------------------------------

export const RecordOffspringRequest: Sync = (
  { request, sessionToken, litterId, offspringId, sex, notes, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("recordOffspring"), sessionToken, litterId, offspringId, sex, notes },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.recordOffspring,
    { userId: user, litterId, offspringId, sex, notes },
  ]),
});

export const RecordOffspringResponseSuccess: Sync = (
  { request, offspringID },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordOffspring") }, { request }],
    [ReproductionTrackingConcept.recordOffspring, {}, { offspringID }],
  ),
  then: actions([
    Requesting.respond,
    { request, offspringID },
  ]),
});

export const RecordOffspringResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordOffspring") }, { request }],
    [ReproductionTrackingConcept.recordOffspring, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const RecordOffspringResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordOffspring"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 6. updateOffspring (userId: String, oldOffspringId: String, newOffspringId: String?, litterId: String?, sex: Enum?, notes: String?): (offspringID: String)
// --------------------------------------------------------------------------------

export const UpdateOffspringRequest: Sync = (
  { request, sessionToken, oldOffspringId, newOffspringId, litterId, sex, notes, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("updateOffspring"), sessionToken, oldOffspringId, newOffspringId, litterId, sex, notes },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.updateOffspring,
    { userId: user, oldOffspringId, newOffspringId, litterId, sex, notes },
  ]),
});

export const UpdateOffspringResponseSuccess: Sync = (
  { request, offspringID },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("updateOffspring") }, { request }],
    [ReproductionTrackingConcept.updateOffspring, {}, { offspringID }],
  ),
  then: actions([
    Requesting.respond,
    { request, offspringID },
  ]),
});

export const UpdateOffspringResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("updateOffspring") }, { request }],
    [ReproductionTrackingConcept.updateOffspring, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const UpdateOffspringResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("updateOffspring"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 7. recordWeaning (userId: String, offspringId: String): (offspringID: String)
// --------------------------------------------------------------------------------

export const RecordWeaningRequest: Sync = (
  { request, sessionToken, offspringId, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("recordWeaning"), sessionToken, offspringId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.recordWeaning,
    { userId: user, offspringId },
  ]),
});

export const RecordWeaningResponseSuccess: Sync = (
  { request, offspringID },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordWeaning") }, { request }],
    [ReproductionTrackingConcept.recordWeaning, {}, { offspringID }],
  ),
  then: actions([
    Requesting.respond,
    { request, offspringID },
  ]),
});

export const RecordWeaningResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordWeaning") }, { request }],
    [ReproductionTrackingConcept.recordWeaning, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const RecordWeaningResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordWeaning"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 8. recordDeath (userId: String, offspringId: String): (offspringId: String)
// --------------------------------------------------------------------------------

export const RecordDeathRequest: Sync = (
  { request, sessionToken, offspringId, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("recordDeath"), sessionToken, offspringId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.recordDeath,
    { userId: user, offspringId },
  ]),
});

export const RecordDeathResponseSuccess: Sync = (
  { request, offspringId },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordDeath") }, { request }],
    [ReproductionTrackingConcept.recordDeath, {}, { offspringId }],
  ),
  then: actions([
    Requesting.respond,
    { request, offspringId },
  ]),
});

export const RecordDeathResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordDeath") }, { request }],
    [ReproductionTrackingConcept.recordDeath, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const RecordDeathResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("recordDeath"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 9. generateReport (userId: String, target: String, startDateRange: Date, endDateRange: Date, name: String): (results: string[])
// --------------------------------------------------------------------------------

export const GenerateReportRequest: Sync = (
  { request, sessionToken, target, startDateRange, endDateRange, name, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("generateReport"), sessionToken, target, startDateRange, endDateRange, name },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.generateReport,
    { userId: user, target, startDateRange, endDateRange, name },
  ]),
});

export const GenerateReportResponseSuccess: Sync = (
  { request, results },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("generateReport") }, { request }],
    [ReproductionTrackingConcept.generateReport, {}, { results }],
  ),
  then: actions([
    Requesting.respond,
    { request, results },
  ]),
});

export const GenerateReportResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("generateReport") }, { request }],
    [ReproductionTrackingConcept.generateReport, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const GenerateReportResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("generateReport"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 10. renameReport (userId: String, oldName: String, newName: String): (newName: String)
// --------------------------------------------------------------------------------

export const RenameReportRequest: Sync = (
  { request, sessionToken, oldName, newName, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("renameReport"), sessionToken, oldName, newName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.renameReport,
    { userId: user, oldName, newName },
  ]),
});

export const RenameReportResponseSuccess: Sync = (
  { request, newName },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("renameReport") }, { request }],
    [ReproductionTrackingConcept.renameReport, {}, { newName }],
  ),
  then: actions([
    Requesting.respond,
    { request, newName },
  ]),
});

export const RenameReportResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("renameReport") }, { request }],
    [ReproductionTrackingConcept.renameReport, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const RenameReportResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("renameReport"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 11. deleteReport (userId: String, reportName: String)
// --------------------------------------------------------------------------------

export const DeleteReportRequest: Sync = (
  { request, sessionToken, reportName, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("deleteReport"), sessionToken, reportName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.deleteReport,
    { userId: user, reportName },
  ]),
});

export const DeleteReportResponseSuccess: Sync = (
  { request },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("deleteReport") }, { request }],
    [ReproductionTrackingConcept.deleteReport, {}, {}], // Empty result for success
  ),
  then: actions([
    Requesting.respond,
    { request, status: "success" }, // Respond with a generic success status
  ]),
});

export const DeleteReportResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("deleteReport") }, { request }],
    [ReproductionTrackingConcept.deleteReport, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const DeleteReportResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("deleteReport"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// 12. regenerateAISummary (userId: String, reportName: String): (summary: String)
// --------------------------------------------------------------------------------

export const RegenerateAISummaryRequest: Sync = (
  { request, sessionToken, reportName, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("regenerateAISummary"), sessionToken, reportName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept.regenerateAISummary,
    { userId: user, reportName },
  ]),
});

export const RegenerateAISummaryResponseSuccess: Sync = (
  { request, summary },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("regenerateAISummary") }, { request }],
    [ReproductionTrackingConcept.regenerateAISummary, {}, { summary }],
  ),
  then: actions([
    Requesting.respond,
    { request, summary },
  ]),
});

export const RegenerateAISummaryResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("regenerateAISummary") }, { request }],
    [ReproductionTrackingConcept.regenerateAISummary, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const RegenerateAISummaryResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("regenerateAISummary"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});


// --------------------------------------------------------------------------------
// QUERIES
// --------------------------------------------------------------------------------

// For queries that return arrays of objects (like _listMothers),
// the concept method itself returns an object like `{ mother: Mother[] }`.
// The 'then' clause can directly bind to this 'mother' array and respond with it.

// --------------------------------------------------------------------------------
// Q1. _viewReport (userId: String, reportName: String): (results: String[])
// --------------------------------------------------------------------------------

export const ViewReportRequest: Sync = (
  { request, sessionToken, reportName, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("_viewReport"), sessionToken, reportName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept._viewReport,
    { userId: user, reportName },
  ]),
});

export const ViewReportResponseSuccess: Sync = (
  { request, results },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_viewReport") }, { request }],
    [ReproductionTrackingConcept._viewReport, {}, { results }],
  ),
  then: actions([
    Requesting.respond,
    { request, results },
  ]),
});

export const ViewReportResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_viewReport") }, { request }],
    [ReproductionTrackingConcept._viewReport, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const ViewReportResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_viewReport"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// Q2. _listMothers (userId: String): (mother: Mother)
// --------------------------------------------------------------------------------

export const ListMothersRequest: Sync = (
  { request, sessionToken, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("_listMothers"), sessionToken },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept._listMothers,
    { userId: user },
  ]),
});

// The _listMothers query returns { mother: Mother[] | error: string }
// We need to capture this array and respond with it.
export const ListMothersResponseSuccess: Sync = (
  { request, mother }, // 'mother' will be the array of mother objects
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_listMothers") }, { request }],
    [ReproductionTrackingConcept._listMothers, {}, { mother }],
  ),
  then: actions([
    Requesting.respond,
    { request, mother }, // Respond with the array directly
  ]),
});

export const ListMothersResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_listMothers") }, { request }],
    [ReproductionTrackingConcept._listMothers, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const ListMothersResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_listMothers"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// Q3. _listLittersByMother (userId: String, motherId: String): (litter: Litter)
// --------------------------------------------------------------------------------

export const ListLittersByMotherRequest: Sync = (
  { request, sessionToken, motherId, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("_listLittersByMother"), sessionToken, motherId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept._listLittersByMother,
    { userId: user, motherId },
  ]),
});

export const ListLittersByMotherResponseSuccess: Sync = (
  { request, litter }, // 'litter' will be the array of litter objects
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_listLittersByMother") }, { request }],
    [ReproductionTrackingConcept._listLittersByMother, {}, { litter }],
  ),
  then: actions([
    Requesting.respond,
    { request, litter },
  ]),
});

export const ListLittersByMotherResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_listLittersByMother") }, { request }],
    [ReproductionTrackingConcept._listLittersByMother, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const ListLittersByMotherResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_listLittersByMother"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// Q4. _listOffspringByLitter (userId: String, litterId: String): (offspring: Offspring)
// --------------------------------------------------------------------------------

export const ListOffspringByLitterRequest: Sync = (
  { request, sessionToken, litterId, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("_listOffspringByLitter"), sessionToken, litterId },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept._listOffspringByLitter,
    { userId: user, litterId },
  ]),
});

export const ListOffspringByLitterResponseSuccess: Sync = (
  { request, offspring }, // 'offspring' will be the array of offspring objects
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_listOffspringByLitter") }, { request }],
    [ReproductionTrackingConcept._listOffspringByLitter, {}, { offspring }],
  ),
  then: actions([
    Requesting.respond,
    { request, offspring },
  ]),
});

export const ListOffspringByLitterResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_listOffspringByLitter") }, { request }],
    [ReproductionTrackingConcept._listOffspringByLitter, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const ListOffspringByLitterResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_listOffspringByLitter"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});

// --------------------------------------------------------------------------------
// Q5. _aiSummary (userId: String, reportName: String): (summary: String)
// --------------------------------------------------------------------------------

export const AiSummaryRequest: Sync = (
  { request, sessionToken, reportName, user, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: makePath("_aiSummary"), sessionToken, reportName },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user, error: authError });
    return frames.filter(($) => !$[authError]);
  },
  then: actions([
    ReproductionTrackingConcept._aiSummary,
    { userId: user, reportName },
  ]),
});

export const AiSummaryResponseSuccess: Sync = (
  { request, summary },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_aiSummary") }, { request }],
    [ReproductionTrackingConcept._aiSummary, {}, { summary }],
  ),
  then: actions([
    Requesting.respond,
    { request, summary },
  ]),
});

export const AiSummaryResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_aiSummary") }, { request }],
    [ReproductionTrackingConcept._aiSummary, {}, { error }],
  ),
  then: actions([
    Requesting.respond,
    { request, error },
  ]),
});

export const AiSummaryResponseAuthError: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: makePath("_aiSummary"), sessionToken: { $exists: true } }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: ($) => $.sessionToken }, { user: { $exists: false }, error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, error: authError },
  ]),
});
```
