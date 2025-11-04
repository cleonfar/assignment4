---
timestamp: 'Mon Nov 03 2025 21:28:50 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_212850.af8e04b9.md]]'
content_id: 70abb02f3f8adcc18f488a15adddca5f8549ebde9b02c0338225dddb69d0a88a
---

# response:

```typescript
// src/syncs/reproduction.sync.ts

import { actions, Frames, Sync } from "@engine";
import { Requesting, UserAuthentication } from "@concepts";
import ReproductionTrackingConcept from "@concepts/ReproductionTracking/ReproductionTrackingConcept.ts";
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
    console.debug("[reproduction.sync] verifyAdapter: missing token");
    return [{ error: "Token is required for authentication." }];
  }
  const result = await UserAuthentication.verify({ token });
  if ("user" in result) {
    console.debug(
      `[reproduction.sync] verifyAdapter: success user=${String(result.user)}`,
    );
    return [{ user: result.user as ID }];
  }
  if ("error" in result) {
    console.warn("[reproduction.sync] verifyAdapter: auth error", result.error);
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

// --- Query Adapters for ReproductionTrackingConcept ---
// These adapters call the concept's query methods, correctly mapping
// userId as required by the updated concept, and wrapping results/errors
// into an array format suitable for frames.query.

// _viewReport
const rt_viewReportAdapter = async (
  { userId, reportName }: { userId: ID; reportName: string },
): Promise<({ results: string[] } | { error: string })[]> => {
  const r = await ReproductionTrackingConcept.prototype._viewReport({ userId, reportName });
  return "results" in r ? [{ results: r.results }] : [{ error: r.error }];
};

// _aiSummary
const rt_aiSummaryAdapter = async (
  { userId, reportName }: { userId: ID; reportName: string },
): Promise<({ summary: string } | { error: string })[]> => {
  const r = await ReproductionTrackingConcept.prototype._aiSummary({ userId, reportName });
  return "summary" in r ? [{ summary: r.summary }] : [{ error: r.error }];
};

// _listMothers
const rt_listMothersAdapter = async (
  { userId }: { userId: ID },
): Promise<({ mother: any[] } | { error: string })[]> => {
  const r = await ReproductionTrackingConcept.prototype._listMothers({ userId });
  return "mother" in r ? [{ mother: r.mother }] : [{ error: r.error }];
};

// _listLittersByMother
const rt_listLittersByMotherAdapter = async (
  { userId, motherId }: { userId: ID; motherId: string },
): Promise<({ litter: any[] } | { error: string })[]> => {
  const r = await ReproductionTrackingConcept.prototype._listLittersByMother({ userId, motherId });
  return "litter" in r ? [{ litter: r.litter }] : [{ error: r.error }];
};

// _listOffspringByLitter
const rt_listOffspringByLitterAdapter = async (
  { userId, litterId }: { userId: ID; litterId: string },
): Promise<({ offspring: any[] } | { error: string })[]> => {
  const r = await ReproductionTrackingConcept.prototype._listOffspringByLitter({ userId, litterId });
  return "offspring" in r ? [{ offspring: r.offspring }] : [{ error: r.error }];
};

// --- Syncs for ReproductionTrackingConcept ---

// --- addMother ---
export const AddMother_Call_Concept: Sync = (
  { request, token, authUser, motherId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/addMother", motherId, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]); // Only proceed if authentication succeeded
  },
  then: actions([
    ReproductionTrackingConcept.prototype.addMother,
    { userId: authUser, motherId },
    {}, // Action doesn't specify an output pattern here, so use empty.
  ]),
});

export const AddMother_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/addMother", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]); // Only proceed if authentication failed
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const AddMother_Respond_Success: Sync = (
  { request, motherIdOutput }, // Capture output from the concept action
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/addMother" },
    { request },
  ]),
  // 'and' clause to match the successful completion of the concept action
  and: actions([
    ReproductionTrackingConcept.prototype.addMother,
    {}, // No input pattern needed here, we're just matching the output
    { motherId: motherIdOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { motherId: motherIdOutput } },
  ]),
});

export const AddMother_Respond_Concept_Error: Sync = (
  { request, conceptError }, // Capture error output from the concept action
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/addMother" },
    { request },
  ]),
  // 'and' clause to match the erroneous completion of the concept action
  and: actions([
    ReproductionTrackingConcept.prototype.addMother,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- removeMother ---
export const RemoveMother_Call_Concept: Sync = (
  { request, token, authUser, motherId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/removeMother", motherId, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: actions([
    ReproductionTrackingConcept.prototype.removeMother,
    { userId: authUser, motherId },
    {},
  ]),
});

export const RemoveMother_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/removeMother", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const RemoveMother_Respond_Success: Sync = (
  { request, motherIdOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/removeMother" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.removeMother,
    {},
    { motherId: motherIdOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { motherId: motherIdOutput } },
  ]),
});

export const RemoveMother_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/removeMother" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.removeMother,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- recordLitter ---
export const RecordLitter_Call_Concept: Sync = (
  { request, token, authUser, motherId, fatherId, birthDateStr, reportedLitterSize, notes, parsedDate },
) => ({
  when: actions([
    Requesting.request,
    {
      path: "/ReproductionTracking/recordLitter",
      motherId,
      fatherId,
      birthDate: birthDateStr,
      reportedLitterSize,
      notes,
      token,
    },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(dateParserAdapter, { dateString: birthDateStr }, { parsedDate });
    return frames.filter(($) => $[parsedDate]); // Ensure date parsing succeeded
  },
  then: actions([
    ReproductionTrackingConcept.prototype.recordLitter,
    {
      userId: authUser,
      motherId,
      fatherId,
      birthDate: parsedDate,
      reportedLitterSize,
      notes,
    },
    {},
  ]),
});

export const RecordLitter_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordLitter", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const RecordLitter_Respond_DateParse_Error: Sync = (
  { request, token, authUser, birthDateStr, parseError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordLitter", birthDate: birthDateStr, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(dateParserAdapter, { dateString: birthDateStr }, { error: parseError });
    return frames.filter(($) => $[parseError]); // Only proceed if date parsing failed
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: parseError } },
  ]),
});

export const RecordLitter_Respond_Success: Sync = (
  { request, litterIDOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordLitter" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.recordLitter,
    {},
    { litterID: litterIDOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { litterID: litterIDOutput } },
  ]),
});

export const RecordLitter_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordLitter" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.recordLitter,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- updateLitter ---
export const UpdateLitter_Call_Concept: Sync = (
  { request, token, authUser, litterId, motherId, fatherId, birthDateStr, reportedLitterSize, notes, parsedDate },
) => ({
  when: actions([
    Requesting.request,
    {
      path: "/ReproductionTracking/updateLitter",
      litterId,
      motherId, // Concept will handle rule about changing motherId
      fatherId,
      birthDate: birthDateStr,
      reportedLitterSize,
      notes,
      token,
    },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Only parse if birthDateStr is provided in the request
    const framesWithBirthDate = frames.filter(($) => $[birthDateStr] !== undefined);
    if (framesWithBirthDate.length > 0) {
      frames = await framesWithBirthDate.query(dateParserAdapter, { dateString: birthDateStr }, { parsedDate });
      frames = frames.filter(($) => $[parsedDate]); // Ensure date parsing succeeded
    }
    return frames;
  },
  then: actions([
    ReproductionTrackingConcept.prototype.updateLitter,
    {
      userId: authUser,
      litterId,
      motherId,
      fatherId,
      birthDate: parsedDate,
      reportedLitterSize,
      notes,
    },
    {},
  ]),
});

export const UpdateLitter_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateLitter", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const UpdateLitter_Respond_DateParse_Error: Sync = (
  { request, token, authUser, birthDateStr, parseError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateLitter", birthDate: birthDateStr, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Only attempt to parse if birthDateStr was provided in the request
    const framesWithBirthDate = frames.filter(($) => $[birthDateStr] !== undefined);
    if (framesWithBirthDate.length > 0) {
      const parsedFrames = await framesWithBirthDate.query(dateParserAdapter, { dateString: birthDateStr }, { error: parseError });
      return parsedFrames.filter(($) => $[parseError]); // Only proceed if date parsing failed
    }
    return new Frames(); // No birthDateStr in request, so no parse error from this field
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: parseError } },
  ]),
});

export const UpdateLitter_Respond_Success: Sync = (
  { request, litterIDOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateLitter" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.updateLitter,
    {},
    { litterID: litterIDOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { litterID: litterIDOutput } },
  ]),
});

export const UpdateLitter_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateLitter" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.updateLitter,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- recordOffspring ---
export const RecordOffspring_Call_Concept: Sync = (
  { request, token, authUser, litterId, offspringId, sex, notes },
) => ({
  when: actions([
    Requesting.request,
    {
      path: "/ReproductionTracking/recordOffspring",
      litterId,
      offspringId,
      sex,
      notes,
      token,
    },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: actions([
    ReproductionTrackingConcept.prototype.recordOffspring,
    { userId: authUser, litterId, offspringId, sex, notes },
    {},
  ]),
});

export const RecordOffspring_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordOffspring", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const RecordOffspring_Respond_Success: Sync = (
  { request, offspringIDOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordOffspring" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.recordOffspring,
    {},
    { offspringID: offspringIDOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { offspringID: offspringIDOutput } },
  ]),
});

export const RecordOffspring_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordOffspring" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.recordOffspring,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- updateOffspring ---
export const UpdateOffspring_Call_Concept: Sync = (
  { request, token, authUser, oldOffspringId, newOffspringId, litterId, sex, notes },
) => ({
  when: actions([
    Requesting.request,
    {
      path: "/ReproductionTracking/updateOffspring",
      oldOffspringId,
      newOffspringId,
      litterId,
      sex,
      notes,
      token,
    },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: actions([
    ReproductionTrackingConcept.prototype.updateOffspring,
    { userId: authUser, oldOffspringId, newOffspringId, litterId, sex, notes },
    {},
  ]),
});

export const UpdateOffspring_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateOffspring", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const UpdateOffspring_Respond_Success: Sync = (
  { request, offspringIDOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateOffspring" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.updateOffspring,
    {},
    { offspringID: offspringIDOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { offspringID: offspringIDOutput } },
  ]),
});

export const UpdateOffspring_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/updateOffspring" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.updateOffspring,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- recordWeaning ---
export const RecordWeaning_Call_Concept: Sync = (
  { request, token, authUser, offspringId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordWeaning", offspringId, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: actions([
    ReproductionTrackingConcept.prototype.recordWeaning,
    { userId: authUser, offspringId },
    {},
  ]),
});

export const RecordWeaning_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordWeaning", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const RecordWeaning_Respond_Success: Sync = (
  { request, offspringIDOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordWeaning" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.recordWeaning,
    {},
    { offspringID: offspringIDOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { offspringID: offspringIDOutput } },
  ]),
});

export const RecordWeaning_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordWeaning" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.recordWeaning,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- recordDeath ---
export const RecordDeath_Call_Concept: Sync = (
  { request, token, authUser, offspringId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordDeath", offspringId, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: actions([
    ReproductionTrackingConcept.prototype.recordDeath,
    { userId: authUser, offspringId },
    {},
  ]),
});

export const RecordDeath_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordDeath", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const RecordDeath_Respond_Success: Sync = (
  { request, offspringIdOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordDeath" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.recordDeath,
    {},
    { offspringId: offspringIdOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { offspringId: offspringIdOutput } },
  ]),
});

export const RecordDeath_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/recordDeath" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.recordDeath,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- generateReport ---
export const GenerateReport_Call_Concept: Sync = (
  { request, token, authUser, target, startDateRangeStr, endDateRangeStr, name, parsedStartDate, parsedEndDate },
) => ({
  when: actions([
    Requesting.request,
    {
      path: "/ReproductionTracking/generateReport",
      target,
      startDateRange: startDateRangeStr,
      endDateRange: endDateRangeStr,
      name,
      token,
    },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(dateParserAdapter, { dateString: startDateRangeStr }, { parsedDate: parsedStartDate });
    frames = frames.filter(($) => $[parsedStartDate]);
    if (frames.length === 0) return frames; // Stop if start date parsing failed

    frames = await frames.query(dateParserAdapter, { dateString: endDateRangeStr }, { parsedDate: parsedEndDate });
    return frames.filter(($) => $[parsedEndDate]); // Ensure end date parsing succeeded
  },
  then: actions([
    ReproductionTrackingConcept.prototype.generateReport,
    {
      userId: authUser,
      target,
      startDateRange: parsedStartDate,
      endDateRange: parsedEndDate,
      name,
    },
    {},
  ]),
});

export const GenerateReport_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/generateReport", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const GenerateReport_Respond_DateParse_Error: Sync = (
  { request, token, authUser, startDateRangeStr, endDateRangeStr, parseError, parsedStartDate },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/generateReport", startDateRange: startDateRangeStr, endDateRange: endDateRangeStr, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Check start date parse first
    frames = await frames.query(dateParserAdapter, { dateString: startDateRangeStr }, { error: parseError, parsedDate: parsedStartDate });
    const startDateFailed = frames.filter(($) => $[parseError] !== undefined);
    if (startDateFailed.length > 0) return startDateFailed;

    // Then check end date parse for successful start date frames
    const startDateSuccessFrames = frames.filter(($) => $[parsedStartDate] !== undefined);
    if (startDateSuccessFrames.length > 0) {
      frames = await startDateSuccessFrames.query(dateParserAdapter, { dateString: endDateRangeStr }, { error: parseError });
      return frames.filter(($) => $[parseError]);
    }

    return new Frames(); // No date parse error, or auth error caught by another sync
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: parseError } },
  ]),
});

export const GenerateReport_Respond_Success: Sync = (
  { request, resultsOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/generateReport" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.generateReport,
    {},
    { results: resultsOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { results: resultsOutput } },
  ]),
});

export const GenerateReport_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/generateReport" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.generateReport,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- renameReport ---
export const RenameReport_Call_Concept: Sync = (
  { request, token, authUser, oldName, newName },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/renameReport", oldName, newName, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: actions([
    ReproductionTrackingConcept.prototype.renameReport,
    { userId: authUser, oldName, newName },
    {},
  ]),
});

export const RenameReport_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/renameReport", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const RenameReport_Respond_Success: Sync = (
  { request, newNameOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/renameReport" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.renameReport,
    {},
    { newName: newNameOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { newName: newNameOutput } },
  ]),
});

export const RenameReport_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/renameReport" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.renameReport,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- deleteReport ---
export const DeleteReport_Call_Concept: Sync = (
  { request, token, authUser, reportName },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/deleteReport", reportName, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: actions([
    ReproductionTrackingConcept.prototype.deleteReport,
    { userId: authUser, reportName },
    {},
  ]),
});

export const DeleteReport_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/deleteReport", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const DeleteReport_Respond_Success: Sync = (
  { request }, // No specific output for delete, just successful completion
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/deleteReport" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.deleteReport,
    {},
    {}, // Match an empty (success) output
  ]),
  then: actions([
    Requesting.respond,
    { request, body: {} }, // Return an empty success body
  ]),
});

export const DeleteReport_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/deleteReport" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.deleteReport,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- _viewReport (Query) ---
export const ViewReport_Call_Concept: Sync = (
  { request, token, authUser, reportName },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport", reportName, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  // Queries generally don't have a 'then' that calls another concept action directly.
  // Instead, the adapter's output is used by the response syncs.
  then: [],
});

export const ViewReport_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const ViewReport_Respond_Success: Sync = (
  { request, authUser, reportName, resultsOutput, queryError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport", reportName },
    { request },
  ]),
  where: async (frames) => {
    // Need to re-authenticate here too because this sync needs a `authUser` binding
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Re-run the query adapter to get the results/error symbols for this specific response sync
    frames = await frames.query(rt_viewReportAdapter, { userId: authUser, reportName }, { results: resultsOutput, error: queryError });
    return frames.filter(($) => $[resultsOutput] !== undefined); // Only keep frames with actual results
  },
  then: actions([
    Requesting.respond,
    { request, body: { results: resultsOutput } },
  ]),
});

export const ViewReport_Respond_Concept_Error: Sync = (
  { request, authUser, reportName, resultsOutput, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport", reportName },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Re-run the query adapter to get the results/error symbols
    frames = await frames.query(rt_viewReportAdapter, { userId: authUser, reportName }, { results: resultsOutput, error: conceptError });
    return frames.filter(($) => $[conceptError] !== undefined); // Only keep frames with an error
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- _aiSummary (Query) ---
export const AISummary_Call_Concept: Sync = (
  { request, token, authUser, reportName },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary", reportName, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: [],
});

export const AISummary_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const AISummary_Respond_Success: Sync = (
  { request, authUser, reportName, summaryOutput, queryError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary", reportName },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_aiSummaryAdapter, { userId: authUser, reportName }, { summary: summaryOutput, error: queryError });
    return frames.filter(($) => $[summaryOutput] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: { summary: summaryOutput } },
  ]),
});

export const AISummary_Respond_Concept_Error: Sync = (
  { request, authUser, reportName, summaryOutput, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary", reportName },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_aiSummaryAdapter, { userId: authUser, reportName }, { summary: summaryOutput, error: conceptError });
    return frames.filter(($) => $[conceptError] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- regenerateAISummary (Action) ---
export const RegenerateAISummary_Call_Concept: Sync = (
  { request, token, authUser, reportName },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/regenerateAISummary", reportName, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: actions([
    ReproductionTrackingConcept.prototype.regenerateAISummary,
    { userId: authUser, reportName },
    {},
  ]),
});

export const RegenerateAISummary_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/regenerateAISummary", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const RegenerateAISummary_Respond_Success: Sync = (
  { request, summaryOutput },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/regenerateAISummary" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.regenerateAISummary,
    {},
    { summary: summaryOutput },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { summary: summaryOutput } },
  ]),
});

export const RegenerateAISummary_Respond_Concept_Error: Sync = (
  { request, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/regenerateAISummary" },
    { request },
  ]),
  and: actions([
    ReproductionTrackingConcept.prototype.regenerateAISummary,
    {},
    { error: conceptError },
  ]),
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- _listMothers (Query) ---
export const ListMothers_Call_Concept: Sync = (
  { request, token, authUser },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: [],
});

export const ListMothers_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const ListMothers_Respond_Success: Sync = (
  { request, authUser, mothersOutput, queryError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers" },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listMothersAdapter, { userId: authUser }, { mother: mothersOutput, error: queryError });
    return frames.filter(($) => $[mothersOutput] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: { mothers: mothersOutput } },
  ]),
});

export const ListMothers_Respond_Concept_Error: Sync = (
  { request, authUser, mothersOutput, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers" },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listMothersAdapter, { userId: authUser }, { mother: mothersOutput, error: conceptError });
    return frames.filter(($) => $[conceptError] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- _listLittersByMother (Query) ---
export const ListLittersByMother_Call_Concept: Sync = (
  { request, token, authUser, motherId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother", motherId, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: [],
});

export const ListLittersByMother_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const ListLittersByMother_Respond_Success: Sync = (
  { request, authUser, motherId, littersOutput, queryError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother", motherId },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listLittersByMotherAdapter, { userId: authUser, motherId }, { litter: littersOutput, error: queryError });
    return frames.filter(($) => $[littersOutput] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: { litters: littersOutput } },
  ]),
});

export const ListLittersByMother_Respond_Concept_Error: Sync = (
  { request, authUser, motherId, littersOutput, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother", motherId },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listLittersByMotherAdapter, { userId: authUser, motherId }, { litter: littersOutput, error: conceptError });
    return frames.filter(($) => $[conceptError] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});

// --- _listOffspringByLitter (Query) ---
export const ListOffspringByLitter_Call_Concept: Sync = (
  { request, token, authUser, litterId },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter", litterId, token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: [],
});

export const ListOffspringByLitter_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { error: authError });
    return frames.filter(($) => $[authError]);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: authError } },
  ]),
});

export const ListOffspringByLitter_Respond_Success: Sync = (
  { request, authUser, litterId, offspringOutput, queryError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter", litterId },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listOffspringByLitterAdapter, { userId: authUser, litterId }, { offspring: offspringOutput, error: queryError });
    return frames.filter(($) => $[offspringOutput] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: { offspring: offspringOutput } },
  ]),
});

export const ListOffspringByLitter_Respond_Concept_Error: Sync = (
  { request, authUser, litterId, offspringOutput, conceptError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter", litterId },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token: frames[0].token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listOffspringByLitterAdapter, { userId: authUser, litterId }, { offspring: offspringOutput, error: conceptError });
    return frames.filter(($) => $[conceptError] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: { error: conceptError } },
  ]),
});
```
