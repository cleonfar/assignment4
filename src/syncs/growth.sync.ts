import { actions, Frames, Sync } from "@engine";
import { GrowthTracking, Requesting, UserAuthentication } from "@concepts";
import { ID } from "@utils/types.ts";

// --- Adapters and Utilities ---

/**
 * Adapter to verify an auth token and retrieve the user ID.
 * Returns a frame with `user` on success or `error` on failure.
 */
const verifyAdapter = async (
  { token }: { token: string },
): Promise<({ user: ID } | { error: string })[]> => {
  if (!token) {
    console.debug("[growth.sync] verifyAdapter: missing token");
    return [{ error: "Token is required for authentication." }];
  }
  console.debug("[growth.sync] verifyAdapter: verifying token");
  const result = await UserAuthentication.verify({ token });
  if ("user" in result) {
    console.debug(
      `[growth.sync] verifyAdapter: success user=${String(result.user)}`,
    );
    return [{ user: result.user as ID }];
  }
  if ("error" in result) {
    console.warn("[growth.sync] verifyAdapter: auth error", result.error);
    return [{ error: result.error }];
  }
  return []; // Should ideally not be reached if verify always returns user or error
};

/**
 * Adapter to parse a date string into a Date object.
 * Returns a frame with `parsedDate` on success or `error` on failure.
 */
const dateParserAdapter = (
  { dateString }: { dateString: string },
): Promise<({ parsedDate: Date } | { error: string })[]> => {
  try {
    if (!dateString) {
      // Assuming dateString is always required if this adapter is used
      return Promise.resolve([
        { error: "Date string is required and cannot be empty." },
      ]);
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return Promise.resolve([
        { error: `Invalid date format: '${dateString}'` },
      ]);
    }
    return Promise.resolve([{ parsedDate: date }]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Promise.resolve([{ error: `Date parsing error: ${msg}` }]);
  }
};

// --- RECORD WEIGHT (Action) ---

// 1. Triggers GrowthTracking.recordWeight after successful authentication and date parsing.
export const RecordWeight_Call_Concept: Sync = (
  {
    request,
    token,
    authUser,
    reqAnimalId,
    reqDateStr,
    parsedDate,
    reqWeight,
    reqNotes,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/recordWeight",
      animal: reqAnimalId,
      date: reqDateStr,
      weight: reqWeight,
      notes: reqNotes,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    // Authenticate user
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]); // Only proceed with authenticated frames

    // Parse date
    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, {
      parsedDate: parsedDate,
    });
    return frames.filter(($) => $[parsedDate]); // Only proceed with successfully parsed dates
  },
  then: actions(
    [GrowthTracking.recordWeight, {
      user: authUser,
      animal: reqAnimalId,
      date: parsedDate,
      weight: reqWeight,
      notes: reqNotes,
    }, {}],
  ),
});

// 2. Responds to Requesting.request when authentication fails.
export const RecordWeight_Respond_Auth_Error: Sync = (
  {
    request,
    token,
    authError,
    reqAnimalId,
    reqDateStr,
    reqWeight,
    reqNotes,
  }, // Capture all request details to match
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/recordWeight",
      animal: reqAnimalId,
      date: reqDateStr,
      weight: reqWeight,
      notes: reqNotes,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]); // Only keep frames where auth failed
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

// 3. Responds to Requesting.request when date parsing fails (after successful auth).
export const RecordWeight_Respond_DateParse_Error: Sync = (
  {
    request,
    token,
    authUser,
    parsedDate,
    parseError,
    reqAnimalId,
    reqDateStr,
    reqWeight,
    reqNotes,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/recordWeight",
      animal: reqAnimalId,
      date: reqDateStr,
      weight: reqWeight,
      notes: reqNotes,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]); // Ensure auth success

    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, {
      parsedDate: parsedDate,
      error: parseError,
    });
    return frames.filter(($) => $[parseError]); // Only keep frames where date parsing failed
  },
  then: actions(
    [Requesting.respond, { request, body: { error: parseError } }],
  ),
});

// 4. Responds on successful `GrowthTracking.recordWeight` call.
// 4/5. Unified post-action responders using state check to avoid timeouts
// Success responder: triggers after the action event and confirms the new record exists.
export const RecordWeight_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    reqAnimalId,
    reqDateStr,
    parsedDate,
    reqWeight,
    rwWeightRecords,
    rwError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/recordWeight",
      animal: reqAnimalId,
      date: reqDateStr,
      weight: reqWeight,
      token,
    }, { request }],
    // Ensure we run after the concept action was invoked (regardless of outputs)
    [GrowthTracking.recordWeight, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Parse date
    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, {
      parsedDate,
    });
    frames = frames.filter(($) => $[parsedDate]);
    if (frames.length === 0) return frames;

    // Read back weights for this animal
    frames = await frames.query(getAnimalWeightsAdapter, {
      user: authUser,
      animal: reqAnimalId,
    }, { weightRecords: rwWeightRecords, error: rwError });
    // Keep frames where the just-recorded weight exists
    frames = frames.filter(($) => {
      const recs = $[rwWeightRecords] as
        | Array<{ date: Date; weight: number; notes?: string }>
        | undefined;
      const d = $[parsedDate] as Date | undefined;
      const w = $[reqWeight] as number | undefined;
      return Array.isArray(recs) && d instanceof Date &&
        typeof w === "number" &&
        recs.some((r) =>
          r?.date instanceof Date && r.date.getTime() === d.getTime() &&
          r.weight === w
        );
    });
    return frames;
  },
  then: actions(
    [Requesting.respond, { request, body: {} }],
  ),
});

export const RecordWeight_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reqAnimalId,
    reqDateStr,
    parsedDate,
    reqWeight,
    rwWeightRecords,
    rwError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/recordWeight",
      animal: reqAnimalId,
      date: reqDateStr,
      weight: reqWeight,
      token,
    }, { request }],
    // Ensure we run after the concept action was invoked (regardless of outputs)
    [GrowthTracking.recordWeight, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Parse date
    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, {
      parsedDate,
    });
    frames = frames.filter(($) => $[parsedDate]);
    if (frames.length === 0) return frames;

    // Read back weights for this animal
    frames = await frames.query(getAnimalWeightsAdapter, {
      user: authUser,
      animal: reqAnimalId,
    }, { weightRecords: rwWeightRecords, error: rwError });
    // Keep frames where the recorded weight is NOT present (treat as error)
    frames = frames.filter(($) => {
      const recs = $[rwWeightRecords] as
        | Array<{ date: Date; weight: number; notes?: string }>
        | undefined;
      const d = $[parsedDate] as Date | undefined;
      const w = $[reqWeight] as number | undefined;
      const ok = Array.isArray(recs) && d instanceof Date &&
        typeof w === "number" &&
        recs.some((r) =>
          r?.date instanceof Date && r.date.getTime() === d.getTime() &&
          r.weight === w
        );
      return !ok;
    });
    return frames;
  },
  then: actions(
    [Requesting.respond, {
      request,
      body: { error: "Failed to record weight." },
    }],
  ),
});

// --- REMOVE WEIGHT RECORD (Action) ---

export const RemoveWeightRecord_Call_Concept: Sync = (
  { request, token, authUser, reqAnimalId, reqDateStr, parsedDate },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/removeWeightRecord",
      animal: reqAnimalId,
      date: reqDateStr,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, {
      parsedDate: parsedDate,
    });
    return frames.filter(($) => $[parsedDate]);
  },
  then: actions(
    [GrowthTracking.removeWeightRecord, {
      user: authUser,
      animal: reqAnimalId,
      date: parsedDate,
    }, {}],
  ),
});

// --- DELETE ANIMAL (Action) ---

export const DeleteAnimal_Call_Concept: Sync = (
  { request, token, authUser, reqAnimalId },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/deleteAnimal",
      animal: reqAnimalId,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: actions(
    [GrowthTracking.deleteAnimal, { user: authUser, animal: reqAnimalId }, {}],
  ),
});

export const DeleteAnimal_Respond_Auth_Error: Sync = (
  { request, token, authError, reqAnimalId },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/deleteAnimal",
      animal: reqAnimalId,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const DeleteAnimal_Respond_Success: Sync = (
  { request, token, authUser, reqAnimalId, gaWeightResult, gaWeightError },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/deleteAnimal",
      animal: reqAnimalId,
      token,
    }, { request }],
    [GrowthTracking.deleteAnimal, {}, {}],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // After deletion, _getAnimalWeights should return error (animal not found)
    frames = await frames.query(getAnimalWeightsAdapter, {
      user: authUser,
      animal: reqAnimalId,
    }, { weightRecords: gaWeightResult, error: gaWeightError });
    return frames.filter(($) => $[gaWeightError]);
  },
  then: actions(
    [Requesting.respond, { request, body: {} }],
  ),
});

export const DeleteAnimal_Respond_Concept_Error: Sync = (
  { request, token, authUser, reqAnimalId, gaWeightResult, gaWeightError },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/deleteAnimal",
      animal: reqAnimalId,
      token,
    }, { request }],
    [GrowthTracking.deleteAnimal, {}, {}],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // If weights query still succeeds, animal still exists -> treat as error
    frames = await frames.query(getAnimalWeightsAdapter, {
      user: authUser,
      animal: reqAnimalId,
    }, { weightRecords: gaWeightResult, error: gaWeightError });
    return frames.filter(($) => $[gaWeightResult]);
  },
  then: actions(
    [Requesting.respond, {
      request,
      body: { error: "Failed to delete animal." },
    }],
  ),
});

export const RemoveWeightRecord_Respond_Auth_Error: Sync = (
  { request, token, authError, reqAnimalId, reqDateStr },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/removeWeightRecord",
      animal: reqAnimalId,
      date: reqDateStr,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const RemoveWeightRecord_Respond_DateParse_Error: Sync = (
  {
    request,
    token,
    authUser,
    parsedDate,
    parseError,
    reqAnimalId,
    reqDateStr,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/removeWeightRecord",
      animal: reqAnimalId,
      date: reqDateStr,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser] && !$[request]);

    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, {
      parsedDate: parsedDate,
      error: parseError,
    });
    return frames.filter(($) => $[parseError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: parseError } }],
  ),
});

export const RemoveWeightRecord_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    reqAnimalId,
    reqDateStr,
    parsedDate,
    rwWeightRecords,
    rwError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/removeWeightRecord",
      animal: reqAnimalId,
      date: reqDateStr,
      token,
    }, { request }],
    [GrowthTracking.removeWeightRecord, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Parse date
    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, {
      parsedDate,
    });
    frames = frames.filter(($) => $[parsedDate]);
    if (frames.length === 0) return frames;

    // Read back weights for this animal and confirm removal
    frames = await frames.query(getAnimalWeightsAdapter, {
      user: authUser,
      animal: reqAnimalId,
    }, { weightRecords: rwWeightRecords, error: rwError });
    // Success if no record with the target date exists anymore
    frames = frames.filter(($) => {
      const recs = $[rwWeightRecords] as
        | Array<{ date: Date; weight: number }>
        | undefined;
      const d = $[parsedDate] as Date | undefined;
      return Array.isArray(recs) && d instanceof Date &&
        !recs.some((r) =>
          r?.date instanceof Date && r.date.getTime() === d.getTime()
        );
    });
    return frames;
  },
  then: actions(
    [Requesting.respond, { request, body: {} }],
  ),
});

export const RemoveWeightRecord_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reqAnimalId,
    reqDateStr,
    parsedDate,
    rwWeightRecords,
    rwError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/removeWeightRecord",
      animal: reqAnimalId,
      date: reqDateStr,
      token,
    }, { request }],
    [GrowthTracking.removeWeightRecord, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Parse date
    frames = await frames.query(dateParserAdapter, { dateString: reqDateStr }, {
      parsedDate,
    });
    frames = frames.filter(($) => $[parsedDate]);
    if (frames.length === 0) return frames;

    // Read back weights for this animal and fail if the record remains
    frames = await frames.query(getAnimalWeightsAdapter, {
      user: authUser,
      animal: reqAnimalId,
    }, { weightRecords: rwWeightRecords, error: rwError });
    frames = frames.filter(($) => {
      const recs = $[rwWeightRecords] as
        | Array<{ date: Date; weight: number }>
        | undefined;
      const d = $[parsedDate] as Date | undefined;
      return Array.isArray(recs) && d instanceof Date &&
        recs.some((r) =>
          r?.date instanceof Date && r.date.getTime() === d.getTime()
        );
    });
    return frames;
  },
  then: actions(
    [Requesting.respond, {
      request,
      body: { error: "Failed to remove weight record." },
    }],
  ),
});

// --- GENERATE REPORT (Action) ---

export const GenerateReport_Call_Concept: Sync = (
  {
    request,
    token,
    authUser,
    reqAnimalId,
    reqStartDateStr,
    reqEndDateStr,
    parsedStartDate,
    parsedEndDate,
    reqReportName,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/generateReport",
      animal: reqAnimalId,
      startDateRange: reqStartDateStr,
      endDateRange: reqEndDateStr,
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    // Parse start date
    frames = await frames.query(dateParserAdapter, {
      dateString: reqStartDateStr,
    }, { parsedDate: parsedStartDate });
    frames = frames.filter(($) => $[parsedStartDate]);
    if (frames.length === 0) return frames; // Stop if start date parsing failed

    // Parse end date
    frames = await frames.query(dateParserAdapter, {
      dateString: reqEndDateStr,
    }, { parsedDate: parsedEndDate });
    frames = frames.filter(($) => $[parsedEndDate]);
    return frames;
  },
  then: actions(
    [GrowthTracking.generateReport, {
      user: authUser,
      animal: reqAnimalId,
      startDateRange: parsedStartDate,
      endDateRange: parsedEndDate,
      reportName: reqReportName,
    }, {}],
  ),
});

export const GenerateReport_Respond_Auth_Error: Sync = (
  {
    request,
    token,
    authError,
    reqAnimalId,
    reqStartDateStr,
    reqEndDateStr,
    reqReportName,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/generateReport",
      animal: reqAnimalId,
      startDateRange: reqStartDateStr,
      endDateRange: reqEndDateStr,
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GenerateReport_Respond_DateParse_Error: Sync = (
  {
    request,
    token,
    authUser,
    parsedStartDate,
    parsedEndDate,
    parseError,
    reqAnimalId,
    reqStartDateStr,
    reqEndDateStr,
    reqReportName,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/generateReport",
      animal: reqAnimalId,
      startDateRange: reqStartDateStr,
      endDateRange: reqEndDateStr,
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    // Save frames for checking both dates (removed unused var)

    // Check start date parse
    frames = await frames.query(dateParserAdapter, {
      dateString: reqStartDateStr,
    }, { parsedDate: parsedStartDate, error: parseError });
    const startDateFailed = frames.filter(($) => $[parseError]);
    if (startDateFailed.length > 0) return startDateFailed;

    // Check end date parse (only if start date was successful)
    const startDateSuccessFrames = frames.filter(($) => !$[parseError]);
    if (startDateSuccessFrames.length > 0) {
      frames = await startDateSuccessFrames.query(dateParserAdapter, {
        dateString: reqEndDateStr,
      }, { parsedDate: parsedEndDate, error: parseError });
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
    [Requesting.request, { path: "/GrowthTracking/generateReport" }, {
      request,
    }],
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
    [Requesting.request, { path: "/GrowthTracking/generateReport" }, {
      request,
    }],
    [GrowthTracking.generateReport, {}, { error: gtGenerateReportError }],
  ),
  then: actions(
    [Requesting.respond, { request, body: { error: gtGenerateReportError } }],
  ),
});

// --- RENAME REPORT (Action) ---

export const RenameReport_Call_Concept: Sync = (
  { request, token, authUser, reqOldName, reqNewName },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/renameReport",
      oldName: reqOldName,
      newName: reqNewName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    return frames.filter(($) => $[authUser]);
  },
  then: actions(
    [GrowthTracking.renameReport, {
      user: authUser,
      oldName: reqOldName,
      newName: reqNewName,
    }, {}],
  ),
});

export const RenameReport_Respond_Auth_Error: Sync = (
  { request, token, authError, reqOldName, reqNewName },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/renameReport",
      oldName: reqOldName,
      newName: reqNewName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const RenameReport_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    reqOldName,
    reqNewName,
    gtGetReportByNameResult,
    gtGetReportByNameError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/renameReport",
      oldName: reqOldName,
      newName: reqNewName,
      token,
    }, { request }],
    [GrowthTracking.renameReport, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Check that the new report name exists now
    frames = await frames.query(getReportByNameAdapter, {
      user: authUser,
      reportName: reqNewName,
    }, { report: gtGetReportByNameResult, error: gtGetReportByNameError });
    return frames.filter(($) => $[gtGetReportByNameResult]);
  },
  then: actions(
    [Requesting.respond, { request, body: { newName: reqNewName } }],
  ),
});

export const RenameReport_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reqOldName,
    reqNewName,
    gtGetReportByNameResult,
    gtGetReportByNameError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/renameReport",
      oldName: reqOldName,
      newName: reqNewName,
      token,
    }, { request }],
    [GrowthTracking.renameReport, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Check new name; treat absence as failure
    frames = await frames.query(getReportByNameAdapter, {
      user: authUser,
      reportName: reqNewName,
    }, { report: gtGetReportByNameResult, error: gtGetReportByNameError });
    return frames.filter(($) => $[gtGetReportByNameError]);
  },
  then: actions(
    [Requesting.respond, {
      request,
      body: { error: "Failed to rename report." },
    }],
  ),
});

// --- DELETE REPORT (Action) ---

export const DeleteReport_Call_Concept: Sync = (
  { request, token, authUser, reqReportName },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/deleteReport",
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    return frames.filter(($) => $[authUser]);
  },
  then: actions(
    [GrowthTracking.deleteReport, {
      user: authUser,
      reportName: reqReportName,
    }, {}],
  ),
});

export const DeleteReport_Respond_Auth_Error: Sync = (
  { request, token, authError, reqReportName },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/deleteReport",
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const DeleteReport_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetReportByNameResult,
    gtGetReportByNameError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/deleteReport",
      reportName: reqReportName,
      token,
    }, { request }],
    [GrowthTracking.deleteReport, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    console.debug(
      "[growth.sync] deleteReport: verifying for success responder",
    );
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Confirm the report no longer exists
    console.debug("[growth.sync] deleteReport: checking report absence", {
      reportName: reqReportName,
    });
    frames = await frames.query(getReportByNameAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { report: gtGetReportByNameResult, error: gtGetReportByNameError });
    // Success: keep frames where lookup returned error (not found)
    return frames.filter(($) => $[gtGetReportByNameError]);
  },
  then: actions(
    [Requesting.respond, { request, body: {} }],
  ),
});

export const DeleteReport_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetReportByNameResult,
    gtGetReportByNameError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/deleteReport",
      reportName: reqReportName,
      token,
    }, { request }],
    [GrowthTracking.deleteReport, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    console.debug("[growth.sync] deleteReport: verifying for error responder");
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // If report still exists, treat as error
    console.debug("[growth.sync] deleteReport: checking report presence", {
      reportName: reqReportName,
    });
    frames = await frames.query(getReportByNameAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { report: gtGetReportByNameResult, error: gtGetReportByNameError });
    return frames.filter(($) => $[gtGetReportByNameResult]);
  },
  then: actions(
    [Requesting.respond, {
      request,
      body: { error: "Failed to delete report." },
    }],
  ),
});

// --- AI SUMMARY (Action) ---

export const AiSummary_Call_Concept: Sync = (
  { request, token, authUser, reqReportName },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/aiSummary",
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    return frames.filter(($) => $[authUser]);
  },
  then: actions(
    [
      GrowthTracking.aiSummary,
      { user: authUser, reportName: reqReportName },
      {},
    ],
  ),
});

export const AiSummary_Respond_Auth_Error: Sync = (
  { request, token, authError, reqReportName },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/aiSummary",
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const AiSummary_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetAiSummaryResult,
    gtGetAiSummaryError,
    summaryBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/aiSummary",
      reportName: reqReportName,
      token,
    }, { request }],
    [GrowthTracking.aiSummary, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Fetch summary via query adapter to ensure symbol is computed locally
    frames = await frames.query(getAiSummaryAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { summary: gtGetAiSummaryResult, error: gtGetAiSummaryError });
    frames = frames.filter(($) => $[gtGetAiSummaryResult]);

    // Wrap
    frames = await frames.query(wrapSummaryBodyAdapter, {
      summary: gtGetAiSummaryResult,
    }, { body: summaryBody });
    return frames.filter(($) => $[summaryBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: summaryBody }],
  ),
});

export const AiSummary_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetAiSummaryResult,
    gtGetAiSummaryError,
    errorBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/aiSummary",
      reportName: reqReportName,
      token,
    }, { request }],
    [GrowthTracking.aiSummary, {}, {}],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Fetch error via query adapter
    frames = await frames.query(getAiSummaryAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { summary: gtGetAiSummaryResult, error: gtGetAiSummaryError });
    frames = frames.filter(($) => $[gtGetAiSummaryError]);

    // Wrap error
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: gtGetAiSummaryError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: errorBody }],
  ),
});

// --- GET AI SUMMARY (Query) ---

// Query adapters so frames.query returns arrays in `where`
const getAiSummaryAdapter = async (
  { user, reportName }: { user: ID; reportName: string },
): Promise<({ summary: string } | { error: string })[]> => {
  const r = await GrowthTracking._getAiSummary({ user, reportName });
  return "summary" in r ? [{ summary: r.summary }] : [{ error: r.error }];
};

export const GetAiSummary_Call_Concept: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetAiSummaryResult,
    gtGetAiSummaryError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAiSummary",
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(getAiSummaryAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { summary: gtGetAiSummaryResult, error: gtGetAiSummaryError });
  },
  then: [],
});

export const GetAiSummary_Respond_Auth_Error: Sync = (
  { request, token, authError, reqReportName },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAiSummary",
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GetAiSummary_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetAiSummaryResult,
    gtGetAiSummaryError,
    summaryBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAiSummary",
      token,
      reportName: reqReportName,
    }, { request }],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Re-run query adapter for this request to compute symbols in this sync
    frames = await frames.query(getAiSummaryAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { summary: gtGetAiSummaryResult, error: gtGetAiSummaryError });
    frames = frames.filter(($) => $[gtGetAiSummaryResult]);

    // Wrap into top-level body symbol
    frames = await frames.query(wrapSummaryBodyAdapter, {
      summary: gtGetAiSummaryResult,
    }, { body: summaryBody });
    return frames.filter(($) => $[summaryBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: summaryBody }],
  ),
});

export const GetAiSummary_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetAiSummaryResult,
    gtGetAiSummaryError,
    errorBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAiSummary",
      token,
      reportName: reqReportName,
    }, { request }],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Re-run query adapter and keep error
    frames = await frames.query(getAiSummaryAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { summary: gtGetAiSummaryResult, error: gtGetAiSummaryError });
    frames = frames.filter(($) => $[gtGetAiSummaryError]);

    // Wrap error
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: gtGetAiSummaryError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: errorBody }],
  ),
});

// --- GET ANIMAL WEIGHTS (Query) ---

const getAnimalWeightsAdapter = async (
  { user, animal }: { user: ID; animal: ID },
): Promise<({ weightRecords: unknown[] } | { error: string })[]> => {
  console.debug(
    `[growth.sync] getAnimalWeightsAdapter: user=${String(user)} animal=${
      String(animal)
    }`,
  );
  const r = await GrowthTracking._getAnimalWeights({ user, animal });
  if ("weightRecords" in r) {
    console.debug(
      `[growth.sync] getAnimalWeightsAdapter: ok weightRecords.length=${
        Array.isArray(r.weightRecords) ? r.weightRecords.length : "(not array)"
      }`,
    );
  } else {
    console.warn("[growth.sync] getAnimalWeightsAdapter: error", r.error);
  }
  return "weightRecords" in r
    ? [{ weightRecords: r.weightRecords }]
    : [{ error: r.error }];
};

export const GetAnimalWeights_Call_Concept: Sync = (
  {
    request,
    token,
    authUser,
    reqAnimalId,
    gtGetAnimalWeightsResult,
    gtGetAnimalWeightsError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAnimalWeights",
      animal: reqAnimalId,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(getAnimalWeightsAdapter, {
      user: authUser,
      animal: reqAnimalId,
    }, {
      weightRecords: gtGetAnimalWeightsResult,
      error: gtGetAnimalWeightsError,
    });
  },
  then: [],
});

export const GetAnimalWeights_Respond_Auth_Error: Sync = (
  { request, token, authError, reqAnimalId },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAnimalWeights",
      animal: reqAnimalId,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GetAnimalWeights_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    reqAnimalId,
    gtGetAnimalWeightsResult,
    gtGetAnimalWeightsError,
    weightRecordsBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAnimalWeights",
      token,
      animal: reqAnimalId,
    }, { request }],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Re-run query adapter
    frames = await frames.query(getAnimalWeightsAdapter, {
      user: authUser,
      animal: reqAnimalId,
    }, {
      weightRecords: gtGetAnimalWeightsResult,
      error: gtGetAnimalWeightsError,
    });
    frames = frames.filter(($) => $[gtGetAnimalWeightsResult]);

    // Serialize to JSON-safe payload (convert Date to ISO strings)
    frames = await frames.query(serializeWeightRecordsBodyAdapter, {
      weightRecords: gtGetAnimalWeightsResult,
    }, { body: weightRecordsBody });
    return frames.filter(($) => $[weightRecordsBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: weightRecordsBody }],
  ),
});

export const GetAnimalWeights_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reqAnimalId,
    gtGetAnimalWeightsResult,
    gtGetAnimalWeightsError,
    errorBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAnimalWeights",
      token,
      animal: reqAnimalId,
    }, { request }],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Re-run query adapter
    frames = await frames.query(getAnimalWeightsAdapter, {
      user: authUser,
      animal: reqAnimalId,
    }, {
      weightRecords: gtGetAnimalWeightsResult,
      error: gtGetAnimalWeightsError,
    });
    frames = frames.filter(($) => $[gtGetAnimalWeightsError]);

    // Wrap error
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: gtGetAnimalWeightsError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: errorBody }],
  ),
});

// --- GET REPORT BY NAME (Query) ---

const getReportByNameAdapter = async (
  { user, reportName }: { user: ID; reportName: string },
): Promise<({ report: unknown } | { error: string })[]> => {
  const r = await GrowthTracking._getReportByName({ user, reportName });
  return "report" in r ? [{ report: r.report }] : [{ error: r.error }];
};

export const GetReportByName_Call_Concept: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetReportByNameResult,
    gtGetReportByNameError,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getReportByName",
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(getReportByNameAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { report: gtGetReportByNameResult, error: gtGetReportByNameError });
  },
  then: [],
});

export const GetReportByName_Respond_Auth_Error: Sync = (
  { request, token, authError, reqReportName },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getReportByName",
      reportName: reqReportName,
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GetReportByName_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetReportByNameResult,
    gtGetReportByNameError,
    reportBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getReportByName",
      token,
      reportName: reqReportName,
    }, { request }],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Re-run query adapter
    frames = await frames.query(getReportByNameAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { report: gtGetReportByNameResult, error: gtGetReportByNameError });
    frames = frames.filter(($) => $[gtGetReportByNameResult]);

    // Wrap
    frames = await frames.query(wrapReportBodyAdapter, {
      report: gtGetReportByNameResult,
    }, { body: reportBody });
    return frames.filter(($) => $[reportBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: reportBody }],
  ),
});

export const GetReportByName_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reqReportName,
    gtGetReportByNameResult,
    gtGetReportByNameError,
    errorBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getReportByName",
      token,
      reportName: reqReportName,
    }, { request }],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Re-run query adapter
    frames = await frames.query(getReportByNameAdapter, {
      user: authUser,
      reportName: reqReportName,
    }, { report: gtGetReportByNameResult, error: gtGetReportByNameError });
    frames = frames.filter(($) => $[gtGetReportByNameError]);

    // Wrap error
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: gtGetReportByNameError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: errorBody }],
  ),
});

// --- LIST REPORTS (Query) ---

const listReportsAdapter = async (
  { user }: { user: ID },
): Promise<({ reports: unknown[] } | { error: string })[]> => {
  const r = await GrowthTracking._listReports({ user });
  return "reports" in r ? [{ reports: r.reports }] : [{ error: r.error }];
};

export const ListReports_Call_Concept: Sync = (
  { request, token, authUser, gtListReportsResult, gtListReportsError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_listReports", token }, {
      request,
    }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(listReportsAdapter, { user: authUser }, {
      reports: gtListReportsResult,
      error: gtListReportsError,
    });
  },
  then: [],
});

export const ListReports_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_listReports", token }, {
      request,
    }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const ListReports_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    gtListReportsResult,
    gtListReportsError,
    listReportsBody,
  },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_listReports", token }, {
      request,
    }],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Run adapter locally
    frames = await frames.query(listReportsAdapter, { user: authUser }, {
      reports: gtListReportsResult,
      error: gtListReportsError,
    });
    frames = frames.filter(($) => $[gtListReportsResult]);

    // Wrap
    frames = await frames.query(wrapReportsBodyAdapter, {
      reports: gtListReportsResult,
    }, { body: listReportsBody });
    return frames.filter(($) => $[listReportsBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: listReportsBody }],
  ),
});

export const ListReports_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    gtListReportsResult,
    gtListReportsError,
    errorBody,
  },
) => ({
  when: actions(
    [Requesting.request, { path: "/GrowthTracking/_listReports", token }, {
      request,
    }],
  ),
  where: async (frames) => {
    // Verify
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Run adapter locally and keep error
    frames = await frames.query(listReportsAdapter, { user: authUser }, {
      reports: gtListReportsResult,
      error: gtListReportsError,
    });
    frames = frames.filter(($) => $[gtListReportsError]);

    // Wrap error
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: gtListReportsError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: errorBody }],
  ),
});
// --- GET ALL ANIMALS WITH WEIGHT RECORDS (Query) ---

const getAllAnimalsWithWeightsAdapter = async (
  { user }: { user: ID },
): Promise<({ animals: ID[] } | { error: string })[]> => {
  const r = await GrowthTracking._getAllAnimalsWithWeightRecords({ user });
  return "animals" in r ? [{ animals: r.animals }] : [{ error: r.error }];
};

// Body wrappers to avoid nested symbol substitution issues in Requesting.respond
const wrapAnimalsBodyAdapter = (
  { animals }: { animals: ID[] },
): Promise<{ body: { animals: ID[] } }[]> =>
  Promise.resolve([{ body: { animals } }]);

const wrapErrorBodyAdapter = (
  { error }: { error: string },
): Promise<{ body: { error: string } }[]> =>
  Promise.resolve([{ body: { error } }]);

const wrapSummaryBodyAdapter = (
  { summary }: { summary: string },
): Promise<{ body: { summary: string } }[]> =>
  Promise.resolve([{ body: { summary } }]);

// Serialize weight records to a JSON-safe shape (Date -> ISO string)
const serializeWeightRecordsBodyAdapter = (
  { weightRecords }: { weightRecords: unknown[] },
): Promise<
  {
    body: {
      weightRecords: Array<{ date: string; weight: number; notes: string }>;
    };
  }[]
> => {
  try {
    const safe = (Array.isArray(weightRecords) ? weightRecords : []).map(
      (r: unknown) => {
        const obj = (typeof r === "object" && r !== null)
          ? r as Record<string, unknown>
          : {};
        const rawDate = obj["date"];
        const d = rawDate instanceof Date
          ? rawDate
          : typeof rawDate === "string"
          ? new Date(rawDate)
          : new Date(rawDate as unknown as string);
        const iso = isNaN(d.getTime())
          ? new Date(0).toISOString()
          : d.toISOString();
        const rawWeight = obj["weight"];
        const weight = typeof rawWeight === "number"
          ? rawWeight
          : Number(rawWeight ?? NaN);
        const rawNotes = obj["notes"];
        const notes = typeof rawNotes === "string"
          ? rawNotes
          : (rawNotes != null ? String(rawNotes) : "");
        return { date: iso, weight, notes };
      },
    );
    return Promise.resolve([{ body: { weightRecords: safe } }]);
  } catch (e) {
    console.warn("[growth.sync] serializeWeightRecordsBodyAdapter error", e);
    return Promise.resolve([{ body: { weightRecords: [] } }]);
  }
};

const wrapReportBodyAdapter = (
  { report }: { report: unknown },
): Promise<{ body: { report: unknown } }[]> =>
  Promise.resolve([{ body: { report } }]);

// Wrap array of reports for response body
const wrapReportsBodyAdapter = (
  { reports }: { reports: unknown[] },
): Promise<{ body: { reports: unknown[] } }[]> =>
  Promise.resolve([{ body: { reports } }]);

export const GetAllAnimalsWithWeightRecords_Call_Concept: Sync = (
  { request, token, authUser, gtGetAllAnimalsResult, gtGetAllAnimalsError },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAllAnimalsWithWeightRecords",
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);
    return await frames.query(getAllAnimalsWithWeightsAdapter, {
      user: authUser,
    }, { animals: gtGetAllAnimalsResult, error: gtGetAllAnimalsError });
  },
  then: [],
});

export const GetAllAnimalsWithWeightRecords_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAllAnimalsWithWeightRecords",
      token,
    }, { request }],
  ),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, {
      error: authError,
    });
    return frames.filter(($) => $[authError]);
  },
  then: actions(
    [Requesting.respond, { request, body: { error: authError } }],
  ),
});

export const GetAllAnimalsWithWeightRecords_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    gtGetAllAnimalsResult,
    gtGetAllAnimalsError,
    animalsBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAllAnimalsWithWeightRecords",
      token,
    }, { request }],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Run the query adapter and keep only success frames
    frames = await frames.query(getAllAnimalsWithWeightsAdapter, {
      user: authUser,
    }, { animals: gtGetAllAnimalsResult, error: gtGetAllAnimalsError });
    frames = frames.filter(($) => $[gtGetAllAnimalsResult]);

    // Wrap animals into a top-level body symbol for Requesting.respond inputs
    frames = await frames.query(wrapAnimalsBodyAdapter, {
      animals: gtGetAllAnimalsResult,
    }, { body: animalsBody });
    return frames.filter(($) => $[animalsBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: animalsBody }],
  ),
});

export const GetAllAnimalsWithWeightRecords_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    gtGetAllAnimalsResult,
    gtGetAllAnimalsError,
    errorBody,
  },
) => ({
  when: actions(
    [Requesting.request, {
      path: "/GrowthTracking/_getAllAnimalsWithWeightRecords",
      token,
    }, { request }],
  ),
  where: async (frames) => {
    // Verify user
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Run the query adapter and keep only error frames
    frames = await frames.query(getAllAnimalsWithWeightsAdapter, {
      user: authUser,
    }, { animals: gtGetAllAnimalsResult, error: gtGetAllAnimalsError });
    frames = frames.filter(($) => $[gtGetAllAnimalsError]);

    // Wrap error into a top-level body symbol for Requesting.respond inputs
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: gtGetAllAnimalsError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody]);
  },
  then: actions(
    [Requesting.respond, { request, body: errorBody }],
  ),
});
