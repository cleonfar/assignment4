---
timestamp: 'Sun Nov 02 2025 19:26:45 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_192645.2eb8109d.md]]'
content_id: fbab9179a11d11bc34e80516b9a0bc2f842ebfb7d0ae71c11ffaee51ab15e17c
---

# response:

Here are the synchronization rules (syncs) for each action and query of the `GrowthTracking` concept, incorporating user authentication via the `UserAuthentication.verify` adapter and handling date conversions where necessary.

These syncs will live in a file like `src/syncs/growth_tracking.sync.ts`.

```typescript
// file: src/syncs/growth_tracking.sync.ts

import { actions, Sync, Frames } from "@engine";
import { Requesting, UserAuthentication, GrowthTracking } from "@concepts"; // Assuming concepts.ts aggregates all concepts
import { ID } from "@utils/types.ts";

// --- Adapters and Utilities ---

/**
 * Adapter to verify a session token and retrieve the user ID.
 * Matches the expected input/output for frames.query.
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
  return []; // Should not be reached if verify always returns user or error
};

/**
 * Adapter to parse a date string into a Date object.
 * Returns an error if the string is invalid.
 */
const dateParserAdapter = async (
  { dateString }: { dateString: string },
): Promise<({ parsedDate: Date } | { error: string })[]> => {
  try {
    if (!dateString) {
      return [{ error: "Date string is required." }];
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

// --- Syncs for GrowthTracking Actions ---

/**
 * Sync for GrowthTracking.recordWeight
 * Handles requests to "/GrowthTracking/recordWeight", authenticates,
 * parses the date, then calls the concept action.
 */
export const RecordWeightSync: Sync = (
  { request, sessionToken, authUser, reqAnimalId, reqDateStr, parsedDate, reqWeight, reqNotes, actionResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/recordWeight",
      animal: reqAnimalId,
      date: reqDateStr, // Date as string from request body
      weight: reqWeight,
      notes: reqNotes,
      sessionToken,
    }, { request }], // Capture the original request
  ),
  where: async (frames) => {
    // Authenticate user via sessionToken
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    // Parse the date string from the request into a Date object
    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, { parsedDate });
    // Filter out any frames that resulted in an error during verification or date parsing
    return frames.filter(($) => !('error' in $));
  },
  then: actions(
    // Call the GrowthTracking.recordWeight action with authenticated user and parsed date
    [GrowthTracking.recordWeight, { user: authUser, animal: reqAnimalId, date: parsedDate, weight: reqWeight, notes: reqNotes }, { result: actionResult, error }],
    // Respond to the original request with the result (or error) from the action
    [Requesting.respond, { request, body: { ...actionResult, error } }],
  ),
});

/**
 * Sync for GrowthTracking.removeWeightRecord
 * Handles requests to "/GrowthTracking/removeWeightRecord", authenticates,
 * parses the date, then calls the concept action.
 */
export const RemoveWeightRecordSync: Sync = (
  { request, sessionToken, authUser, reqAnimalId, reqDateStr, parsedDate, actionResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/removeWeightRecord",
      animal: reqAnimalId,
      date: reqDateStr, // Date as string from request body
      sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, { parsedDate });
    return frames.filter(($) => !('error' in $));
  },
  then: actions(
    [GrowthTracking.removeWeightRecord, { user: authUser, animal: reqAnimalId, date: parsedDate }, { result: actionResult, error }],
    [Requesting.respond, { request, body: { ...actionResult, error } }],
  ),
});

/**
 * Sync for GrowthTracking.generateReport
 * Handles requests to "/GrowthTracking/generateReport", authenticates,
 * parses date ranges, then calls the concept action.
 */
export const GenerateReportSync: Sync = (
  { request, sessionToken, authUser, reqAnimalId, reqStartDateStr, reqEndDateStr, parsedStartDate, parsedEndDate, reqReportName, actionResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/generateReport",
      animal: reqAnimalId,
      startDateRange: reqStartDateStr,
      endDateRange: reqEndDateStr,
      reportName: reqReportName,
      sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = await frames.query(dateParserAdapter, { dateString: reqStartDateStr }, { parsedDate: parsedStartDate });
    frames = await frames.query(dateParserAdapter, { dateString: reqEndDateStr }, { parsedDate: parsedEndDate });
    return frames.filter(($) => !('error' in $));
  },
  then: actions(
    [GrowthTracking.generateReport, { user: authUser, animal: reqAnimalId, startDateRange: parsedStartDate, endDateRange: parsedEndDate, reportName: reqReportName }, { report: actionResult, error }],
    [Requesting.respond, { request, body: { report: actionResult, error } }],
  ),
});

/**
 * Sync for GrowthTracking.renameReport
 * Handles requests to "/GrowthTracking/renameReport", authenticates,
 * then calls the concept action.
 */
export const RenameReportSync: Sync = (
  { request, sessionToken, authUser, reqOldName, reqNewName, actionResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/renameReport",
      oldName: reqOldName,
      newName: reqNewName,
      sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    return frames.filter(($) => !('error' in $));
  },
  then: actions(
    [GrowthTracking.renameReport, { user: authUser, oldName: reqOldName, newName: reqNewName }, { newName: actionResult, error }],
    [Requesting.respond, { request, body: { newName: actionResult, error } }],
  ),
});

/**
 * Sync for GrowthTracking.deleteReport
 * Handles requests to "/GrowthTracking/deleteReport", authenticates,
 * then calls the concept action.
 */
export const DeleteReportSync: Sync = (
  { request, sessionToken, authUser, reqReportName, actionResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/deleteReport",
      reportName: reqReportName,
      sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    return frames.filter(($) => !('error' in $));
  },
  then: actions(
    [GrowthTracking.deleteReport, { user: authUser, reportName: reqReportName }, { result: actionResult, error }],
    [Requesting.respond, { request, body: { ...actionResult, error } }],
  ),
});

/**
 * Sync for GrowthTracking.aiSummary (action)
 * Handles requests to "/GrowthTracking/aiSummary", authenticates,
 * then calls the concept action to force summary generation.
 */
export const AiSummaryActionSync: Sync = (
  { request, sessionToken, authUser, reqReportName, actionResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/aiSummary",
      reportName: reqReportName,
      sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    return frames.filter(($) => !('error' in $));
  },
  then: actions(
    [GrowthTracking.aiSummary, { user: authUser, reportName: reqReportName }, { summary: actionResult, error }],
    [Requesting.respond, { request, body: { summary: actionResult, error } }],
  ),
});


// --- Syncs for GrowthTracking Queries ---

/**
 * Sync for GrowthTracking._getAiSummary (query)
 * Handles requests to "/GrowthTracking/_getAiSummary", authenticates,
 * then calls the concept query to get or generate an AI summary.
 */
export const GetAiSummaryQuerySync: Sync = (
  { request, sessionToken, authUser, reqReportName, queryResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAiSummary", // Note the underscore for queries
      reportName: reqReportName,
      sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    // Call the concept query with the authenticated user
    frames = await frames.query(GrowthTracking._getAiSummary, { user: authUser, reportName: reqReportName }, { summary: queryResult, error });
    return frames.filter(($) => !('error' in $)); // Filter out frames where the query itself returned an error
  },
  then: actions(
    // Respond directly with the query result
    [Requesting.respond, { request, body: { summary: queryResult, error } }],
  ),
});

/**
 * Sync for GrowthTracking._getAnimalWeights (query)
 * Handles requests to "/GrowthTracking/_getAnimalWeights", authenticates,
 * then calls the concept query.
 */
export const GetAnimalWeightsQuerySync: Sync = (
  { request, sessionToken, authUser, reqAnimalId, queryResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAnimalWeights",
      animal: reqAnimalId,
      sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = await frames.query(GrowthTracking._getAnimalWeights, { user: authUser, animal: reqAnimalId }, { weightRecords: queryResult, error });
    return frames.filter(($) => !('error' in $));
  },
  then: actions(
    [Requesting.respond, { request, body: { weightRecords: queryResult, error } }],
  ),
});

/**
 * Sync for GrowthTracking._getReportByName (query)
 * Handles requests to "/GrowthTracking/_getReportByName", authenticates,
 * then calls the concept query.
 */
export const GetReportByNameQuerySync: Sync = (
  { request, sessionToken, authUser, reqReportName, queryResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getReportByName",
      reportName: reqReportName,
      sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = await frames.query(GrowthTracking._getReportByName, { user: authUser, reportName: reqReportName }, { report: queryResult, error });
    return frames.filter(($) => !('error' in $));
  },
  then: actions(
    [Requesting.respond, { request, body: { report: queryResult, error } }],
  ),
});

/**
 * Sync for GrowthTracking._getAllAnimalsWithWeightRecords (query)
 * Handles requests to "/GrowthTracking/_getAllAnimalsWithWeightRecords", authenticates,
 * then calls the concept query.
 */
export const GetAllAnimalsWithWeightRecordsQuerySync: Sync = (
  { request, sessionToken, authUser, queryResult, error },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAllAnimalsWithWeightRecords",
      sessionToken,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken }, { user: authUser });
    frames = await frames.query(GrowthTracking._getAllAnimalsWithWeightRecords, { user: authUser }, { animals: queryResult, error });
    return frames.filter(($) => !('error' in $));
  },
  then: actions(
    [Requesting.respond, { request, body: { animals: queryResult, error } }],
  ),
});
```
