---
timestamp: 'Sun Nov 02 2025 21:53:01 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_215301.7f6d5fc8.md]]'
content_id: 48d0602f5a6dacc6ca08138b06875750c263f71aab51507b67508b332d285647
---

# file: src/syncs/growth\_tracking.sync.ts

```typescript
import { actions, Sync, Frames } from "@engine";
import { Requesting, UserAuthentication, GrowthTracking } from "@concepts";
import { ID } from "@utils/types.ts";

// --- Adapters and Utilities ---

/**
 * Adapter to verify a session token and retrieve the user ID.
 * Returns a frame with `user` on success or `error` on failure.
 */
const verifyAdapter = async (
  { sessionToken }: { sessionToken: string },
): Promise<({ user: ID } | { error: string })[]> => {
  if (!sessionToken) {
    return [{ error: "Session token is required for authentication." }];
  }
  const result = await UserAuthentication.verify({ token: sessionToken });
  if ("user" in result) {
    return [{ user: result.user as ID }];
  }
  if ("error" in result) {
    return [{ error: result.error }];
  }
  return []; // Should ideally not be reached if verify always returns user or error
};

/**
 * Adapter to parse a date string into a Date object.
 * Returns a frame with `parsedDate` on success or `error` on failure.
 */
const dateParserAdapter = async (
  { dateString }: { dateString: string },
): Promise<({ parsedDate: Date } | { error: string })[]> => {
  try {
    if (!dateString) {
      // Assuming dateString is always required if this adapter is used
      return [{ error: "Date string is required and cannot be empty." }];
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return [{ error: `Invalid date format: '${dateString}'` }];
    }
    return [{ parsedDate: date }];
  } catch (e: any) {
    return [{ error: `Date parsing error: ${e.message}` }];
  }
};

// --- RECORD WEIGHT (Action) ---

// 1. Triggers GrowthTracking.recordWeight after successful authentication and date parsing.
export const RecordWeight_Call_Concept: Sync = (
  { request, sessionToken, authUser, reqAnimalId, reqDateStr, parsedDate, reqWeight, reqNotes },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/recordWeight",
      animal: reqAnimalId, date: reqDateStr, weight: reqWeight, notes: reqNotes, sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    // Authenticate user
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]); // Only proceed with authenticated frames

    // Parse date
    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, { parsedDate: parsedDate });
    frames = frames.filter(($) => $[parsedDate]); // Only proceed with successfully parsed dates

    // Now call the concept action and capture its exact results for subsequent syncs
    return await frames.query(GrowthTracking.recordWeight, {
      user: authUser, animal: reqAnimalId, date: parsedDate, weight: reqWeight, notes: reqNotes,
    }, { result: 'gtRecordWeightResult', error: 'gtRecordWeightError' });
  },
  then: [], // No direct `then` in this sync, subsequent syncs will match on GrowthTracking.recordWeight's output
});

// 2. Responds to Requesting.request when authentication fails.
export const RecordWeight_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError, reqAnimalId, reqDateStr, reqWeight, reqNotes }, // Capture all request details to match
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/recordWeight",
      animal: reqAnimalId, date: reqDateStr, weight: reqWeight, notes: reqNotes, sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]); // Only keep frames where auth failed
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

// 3. Responds to Requesting.request when date parsing fails (after successful auth).
export const RecordWeight_Respond_DateParse_Error: Sync = (
  { request, sessionToken, authUser, parseError, reqAnimalId, reqDateStr, reqWeight, reqNotes },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/recordWeight",
      animal: reqAnimalId, date: reqDateStr, weight: reqWeight, notes: reqNotes, sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser] && !$[request]); // Ensure auth success AND original request still in flow.
                                                              // The !$[request] check prevents this sync from firing if the auth error sync already picked it up.

    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, { parsedDate: 'tempDate', error: parseError });
    return frames.filter(($) => $[parseError]); // Only keep frames where date parsing failed
  },
  then: actions(
    [Requesting.respond, { request, body: { error: parseError } }],
  ),
});

// 4. Responds on successful `GrowthTracking.recordWeight` call.
export const RecordWeight_Respond_Success: Sync = (
  { request, gtRecordWeightResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/recordWeight" }, { request }], // Match original request flow
    [GrowthTracking.recordWeight, {}, { result: gtRecordWeightResult }], // Match the success output (empty object)
  ),
  then: actions(
    [Requesting.respond, { request, body: {} }], // Respond with empty object for success
  ),
});

// 5. Responds on error from `GrowthTracking.recordWeight` call.
export const RecordWeight_Respond_Concept_Error: Sync = (
  { request, gtRecordWeightError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/recordWeight" }, { request }], // Match original request flow
    [GrowthTracking.recordWeight, {}, { error: gtRecordWeightError }], // Match error output from the concept action
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtRecordWeightError } }], // Respond with the error string
  ),
});

// --- REMOVE WEIGHT RECORD (Action) ---

export const RemoveWeightRecord_Call_Concept: Sync = (
  { request, sessionToken, authUser, reqAnimalId, reqDateStr, parsedDate },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/removeWeightRecord", animal: reqAnimalId, date: reqDateStr, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, { parsedDate: parsedDate });
    frames = frames.filter(($) => $[parsedDate]);

    return await frames.query(GrowthTracking.removeWeightRecord, {
      user: authUser, animal: reqAnimalId, date: parsedDate,
    }, { result: 'gtRemoveWeightRecordResult', error: 'gtRemoveWeightRecordError' });
  },
  then: [],
});

export const RemoveWeightRecord_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError, reqAnimalId, reqDateStr },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/removeWeightRecord", animal: reqAnimalId, date: reqDateStr, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const RemoveWeightRecord_Respond_DateParse_Error: Sync = (
  { request, sessionToken, authUser, parsedDate, parseError, reqAnimalId, reqDateStr },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/removeWeightRecord", animal: reqAnimalId, date: reqDateStr, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser] && !$[request]);

    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, { parsedDate: parsedDate, error: parseError });
    return frames.filter(($) => $[parseError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: parseError } }],
  ),
});

export const RemoveWeightRecord_Respond_Success: Sync = (
  { request, gtRemoveWeightRecordResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/removeWeightRecord" }, { request }],
    [GrowthTracking.removeWeightRecord, {}, { result: gtRemoveWeightRecordResult }],
  ),
  then: actions(
    [Requesting.respond, { request, body: {} }],
  ),
});

export const RemoveWeightRecord_Respond_Concept_Error: Sync = (
  { request, gtRemoveWeightRecordError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/removeWeightRecord" }, { request }],
    [GrowthTracking.removeWeightRecord, {}, { error: gtRemoveWeightRecordError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtRemoveWeightRecordError } }],
  ),
});

// --- GENERATE REPORT (Action) ---

export const GenerateReport_Call_Concept: Sync = (
  { request, sessionToken, authUser, reqAnimalId, reqStartDateStr, reqEndDateStr, parsedStartDate, parsedEndDate, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/generateReport", animal: reqAnimalId, startDateRange: reqStartDateStr, endDateRange: reqEndDateStr, reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Parse start date
    frames = await frames.query(dateParserAdapter, { dateString: reqStartDateStr }, { parsedDate: parsedStartDate });
    frames = frames.filter(($) => $[parsedStartDate]);
    if (frames.length === 0) return frames; // Stop if start date parsing failed

    // Parse end date
    frames = await frames.query(dateParserAdapter, { dateString: reqEndDateStr }, { parsedDate: parsedEndDate });
    frames = frames.filter(($) => $[parsedEndDate]);

    return await frames.query(GrowthTracking.generateReport, {
      user: authUser, animal: reqAnimalId, startDateRange: parsedStartDate, endDateRange: parsedEndDate, reportName: reqReportName,
    }, { report: 'gtGenerateReportResult', error: 'gtGenerateReportError' });
  },
  then: [],
});

export const GenerateReport_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError, reqAnimalId, reqStartDateStr, reqEndDateStr, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/generateReport", animal: reqAnimalId, startDateRange: reqStartDateStr, endDateRange: reqEndDateStr, reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GenerateReport_Respond_DateParse_Error: Sync = (
  { request, sessionToken, authUser, parsedStartDate, parsedEndDate, parseError, reqAnimalId, reqStartDateStr, reqEndDateStr, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/generateReport", animal: reqAnimalId, startDateRange: reqStartDateStr, endDateRange: reqEndDateStr, reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser] && !$[request]);

    const initialFrames = frames; // Save frames for checking both dates
    
    // Check start date parse
    frames = await frames.query(dateParserAdapter, { dateString: reqStartDateStr }, { parsedDate: parsedStartDate, error: parseError });
    const startDateFailed = frames.filter(($) => $[parseError]);
    if (startDateFailed.length > 0) return startDateFailed;

    // Check end date parse (only if start date was successful)
    const startDateSuccessFrames = frames.filter(($) => !$[parseError]);
    if (startDateSuccessFrames.length > 0) {
      frames = await startDateSuccessFrames.query(dateParserAdapter, { dateString: reqEndDateStr }, { parsedDate: parsedEndDate, error: parseError });
      return frames.filter(($) => $[parseError]);
    }

    return new Frames(); // No date parse error, or auth error caught by another sync
  },
  then: actions(
    [Requesting.respond, { request, body: { error: parseError } }],
  ),
});

export const GenerateReport_Respond_Success: Sync = (
  { request, gtGenerateReportResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/generateReport" }, { request }],
    [GrowthTracking.generateReport, {}, { report: gtGenerateReportResult }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { report: gtGenerateReportResult } }],
  ),
});

export const GenerateReport_Respond_Concept_Error: Sync = (
  { request, gtGenerateReportError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/generateReport" }, { request }],
    [GrowthTracking.generateReport, {}, { error: gtGenerateReportError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtGenerateReportError } }],
  ),
});

// --- RENAME REPORT (Action) ---

export const RenameReport_Call_Concept: Sync = (
  { request, sessionToken, authUser, reqOldName, reqNewName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/renameReport", oldName: reqOldName, newName: reqNewName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(GrowthTracking.renameReport, {
      user: authUser, oldName: reqOldName, newName: reqNewName,
    }, { newName: 'gtRenameReportResult', error: 'gtRenameReportError' });
  },
  then: [],
});

export const RenameReport_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError, reqOldName, reqNewName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/renameReport", oldName: reqOldName, newName: reqNewName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const RenameReport_Respond_Success: Sync = (
  { request, gtRenameReportResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/renameReport" }, { request }],
    [GrowthTracking.renameReport, {}, { newName: gtRenameReportResult }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { newName: gtRenameReportResult } }],
  ),
});

export const RenameReport_Respond_Concept_Error: Sync = (
  { request, gtRenameReportError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/renameReport" }, { request }],
    [GrowthTracking.renameReport, {}, { error: gtRenameReportError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtRenameReportError } }],
  ),
});

// --- DELETE REPORT (Action) ---

export const DeleteReport_Call_Concept: Sync = (
  { request, sessionToken, authUser, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/deleteReport", reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(GrowthTracking.deleteReport, {
      user: authUser, reportName: reqReportName,
    }, { result: 'gtDeleteReportResult', error: 'gtDeleteReportError' });
  },
  then: [],
});

export const DeleteReport_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/deleteReport", reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const DeleteReport_Respond_Success: Sync = (
  { request, gtDeleteReportResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/deleteReport" }, { request }],
    [GrowthTracking.deleteReport, {}, { result: gtDeleteReportResult }],
  ),
  then: actions(
    [Requesting.respond, { request, body: {} }],
  ),
});

export const DeleteReport_Respond_Concept_Error: Sync = (
  { request, gtDeleteReportError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/deleteReport" }, { request }],
    [GrowthTracking.deleteReport, {}, { error: gtDeleteReportError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtDeleteReportError } }],
  ),
});

// --- AI SUMMARY (Action) ---

export const AiSummary_Call_Concept: Sync = (
  { request, sessionToken, authUser, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/aiSummary", reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(GrowthTracking.aiSummary, {
      user: authUser, reportName: reqReportName,
    }, { summary: 'gtAiSummaryResult', error: 'gtAiSummaryError' });
  },
  then: [],
});

export const AiSummary_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/aiSummary", reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const AiSummary_Respond_Success: Sync = (
  { request, gtAiSummaryResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/aiSummary" }, { request }],
    [GrowthTracking.aiSummary, {}, { summary: gtAiSummaryResult }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { summary: gtAiSummaryResult } }],
  ),
});

export const AiSummary_Respond_Concept_Error: Sync = (
  { request, gtAiSummaryError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/aiSummary" }, { request }],
    [GrowthTracking.aiSummary, {}, { error: gtAiSummaryError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtAiSummaryError } }],
  ),
});

// --- GET AI SUMMARY (Query) ---

export const GetAiSummary_Call_Concept: Sync = (
  { request, sessionToken, authUser, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAiSummary", reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(GrowthTracking._getAiSummary, {
      user: authUser, reportName: reqReportName,
    }, { summary: 'gtGetAiSummaryResult', error: 'gtGetAiSummaryError' });
  },
  then: [],
});

export const GetAiSummary_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAiSummary", reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GetAiSummary_Respond_Success: Sync = (
  { request, gtGetAiSummaryResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAiSummary" }, { request }],
    [GrowthTracking._getAiSummary, {}, { summary: gtGetAiSummaryResult }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { summary: gtGetAiSummaryResult } }],
  ),
});

export const GetAiSummary_Respond_Concept_Error: Sync = (
  { request, gtGetAiSummaryError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAiSummary" }, { request }],
    [GrowthTracking._getAiSummary, {}, { error: gtGetAiSummaryError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtGetAiSummaryError } }],
  ),
});

// --- GET ANIMAL WEIGHTS (Query) ---

export const GetAnimalWeights_Call_Concept: Sync = (
  { request, sessionToken, authUser, reqAnimalId },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAnimalWeights", animal: reqAnimalId, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(GrowthTracking._getAnimalWeights, {
      user: authUser, animal: reqAnimalId,
    }, { weightRecords: 'gtGetAnimalWeightsResult', error: 'gtGetAnimalWeightsError' });
  },
  then: [],
});

export const GetAnimalWeights_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError, reqAnimalId },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAnimalWeights", animal: reqAnimalId, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GetAnimalWeights_Respond_Success: Sync = (
  { request, gtGetAnimalWeightsResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAnimalWeights" }, { request }],
    [GrowthTracking._getAnimalWeights, {}, { weightRecords: gtGetAnimalWeightsResult }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { weightRecords: gtGetAnimalWeightsResult } }],
  ),
});

export const GetAnimalWeights_Respond_Concept_Error: Sync = (
  { request, gtGetAnimalWeightsError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAnimalWeights" }, { request }],
    [GrowthTracking._getAnimalWeights, {}, { error: gtGetAnimalWeightsError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtGetAnimalWeightsError } }],
  ),
});

// --- GET REPORT BY NAME (Query) ---

export const GetReportByName_Call_Concept: Sync = (
  { request, sessionToken, authUser, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getReportByName", reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(GrowthTracking._getReportByName, {
      user: authUser, reportName: reqReportName,
    }, { report: 'gtGetReportByNameResult', error: 'gtGetReportByNameError' });
  },
  then: [],
});

export const GetReportByName_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError, reqReportName },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getReportByName", reportName: reqReportName, sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GetReportByName_Respond_Success: Sync = (
  { request, gtGetReportByNameResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getReportByName" }, { request }],
    [GrowthTracking._getReportByName, {}, { report: gtGetReportByNameResult }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { report: gtGetReportByNameResult } }],
  ),
});

export const GetReportByName_Respond_Concept_Error: Sync = (
  { request, gtGetReportByNameError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getReportByName" }, { request }],
    [GrowthTracking._getReportByName, {}, { error: gtGetReportByNameError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtGetReportByNameError } }],
  ),
});

// --- GET ALL ANIMALS WITH WEIGHT RECORDS (Query) ---

export const GetAllAnimalsWithWeightRecords_Call_Concept: Sync = (
  { request, sessionToken, authUser },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAllAnimalsWithWeightRecords", sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(GrowthTracking._getAllAnimalsWithWeightRecords, {
      user: authUser,
    }, { animals: 'gtGetAllAnimalsResult', error: 'gtGetAllAnimalsError' });
  },
  then: [],
});

export const GetAllAnimalsWithWeightRecords_Respond_Auth_Error: Sync = (
  { request, sessionToken, authError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAllAnimalsWithWeightRecords", sessionToken }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: 'tempUser', error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GetAllAnimalsWithWeightRecords_Respond_Success: Sync = (
  { request, gtGetAllAnimalsResult },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAllAnimalsWithWeightRecords" }, { request }],
    [GrowthTracking._getAllAnimalsWithWeightRecords, {}, { animals: gtGetAllAnimalsResult }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { animals: gtGetAllAnimalsResult } }],
  ),
});

export const GetAllAnimalsWithWeightRecords_Respond_Concept_Error: Sync = (
  { request, gtGetAllAnimalsError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_getAllAnimalsWithWeightRecords" }, { request }],
    [GrowthTracking._getAllAnimalsWithWeightRecords, {}, { error: gtGetAllAnimalsError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtGetAllAnimalsError } }],
  ),
});
```
