// src/syncs/reproduction.sync.ts

import { actions, Frames, Sync } from "@engine";
import {
  ReproductionTracking,
  Requesting,
  UserAuthentication,
} from "@concepts";
import { ID } from "@utils/types.ts";

// Local shapes matching the concept's data structures (for adapter typing only)
type RT_Mother = {
  _id: ID;
  ownerId: ID;
  externalId: ID;
  notes: string;
  nextLitterNumber: number;
};

type RT_Litter = {
  _id: ID;
  ownerId: ID;
  motherId: ID;
  fatherId: ID;
  birthDate: Date;
  reportedLitterSize: number;
  notes: string;
};

type RT_Offspring = {
  _id: ID;
  ownerId: ID;
  litterId: ID;
  externalId: ID;
  sex: "male" | "female" | "neutered";
  notes: string;
  isAlive: boolean;
  survivedTillWeaning: boolean;
};

type RT_Report = {
  _id: ID;
  ownerId: ID;
  name: string;
  dateGenerated: Date;
  target: ID[];
  results: string[];
  summary: string;
};

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
  { user, reportName }: { user: ID; reportName: string },
): Promise<({ results: string[] } | { error: string })[]> => {
  const r = await ReproductionTracking._viewReport({
    user: String(user),
    reportName,
  });
  if (r.results !== undefined) return [{ results: r.results }];
  if (r.error !== undefined) return [{ error: r.error }];
  return [{ error: "Unknown _viewReport response" }];
};

// _aiSummary
const rt_aiSummaryAdapter = async (
  { user, reportName }: { user: ID; reportName: string },
): Promise<({ summary: string } | { error: string })[]> => {
  const r = await ReproductionTracking._aiSummary({
    user: String(user),
    reportName,
  });
  if (r.summary !== undefined) return [{ summary: r.summary }];
  if (r.error !== undefined) return [{ error: r.error }];
  return [{ error: "Unknown _aiSummary response" }];
};

// _listMothers
const rt_listMothersAdapter = async (
  { user }: { user: ID },
): Promise<({ mother: RT_Mother[] } | { error: string })[]> => {
  const r = await ReproductionTracking._listMothers({
    user: String(user),
  });
  if (r.mother !== undefined) return [{ mother: r.mother as RT_Mother[] }];
  if (r.error !== undefined) return [{ error: r.error }];
  return [{ error: "Unknown _listMothers response" }];
};

// _listLittersByMother
const rt_listLittersByMotherAdapter = async (
  { user, motherId }: { user: ID; motherId: string },
): Promise<({ litter: RT_Litter[] } | { error: string })[]> => {
  const r = await ReproductionTracking._listLittersByMother({
    user: String(user),
    motherId,
  });
  if (r.litter !== undefined) return [{ litter: r.litter as RT_Litter[] }];
  if (r.error !== undefined) return [{ error: r.error }];
  return [{ error: "Unknown _listLittersByMother response" }];
};

// _listOffspringByLitter
const rt_listOffspringByLitterAdapter = async (
  { user, litterId }: { user: ID; litterId: string },
): Promise<({ offspring: RT_Offspring[] } | { error: string })[]> => {
  const r = await ReproductionTracking._listOffspringByLitter({
    user: String(user),
    litterId,
  });
  if (r.offspring !== undefined) {
    return [{ offspring: r.offspring as RT_Offspring[] }];
  }
  if (r.error !== undefined) return [{ error: r.error }];
  return [{ error: "Unknown _listOffspringByLitter response" }];
};

// _listReports
const rt_listReportsAdapter = async (
  { user }: { user: ID },
): Promise<({ report: RT_Report[] } | { error: string })[]> => {
  const r = await ReproductionTracking._listReports({ user: String(user) });
  if (r.report !== undefined) return [{ report: r.report as RT_Report[] }];
  if (r.error !== undefined) return [{ error: r.error }];
  return [{ error: "Unknown _listReports response" }];
};

// Body wrappers to mirror growth.sync.ts response style and avoid nested symbol substitution
const wrapErrorBodyAdapter = (
  { error }: { error: string },
): Promise<{ body: { error: string } }[]> =>
  Promise.resolve([{ body: { error } }]);

const wrapResultsBodyAdapter = (
  { results }: { results: string[] },
): Promise<{ body: { results: string[] } }[]> =>
  Promise.resolve([{ body: { results } }]);

const wrapSummaryBodyAdapter = (
  { summary }: { summary: string },
): Promise<{ body: { summary: string } }[]> =>
  Promise.resolve([{ body: { summary } }]);

const wrapMothersBodyAdapter = (
  { mothers }: { mothers: RT_Mother[] },
): Promise<{ body: { mothers: RT_Mother[] } }[]> =>
  Promise.resolve([{ body: { mothers } }]);

const wrapLittersBodyAdapter = (
  { litters }: { litters: RT_Litter[] },
): Promise<{ body: { litters: RT_Litter[] } }[]> =>
  Promise.resolve([{ body: { litters } }]);

const wrapOffspringBodyAdapter = (
  { offspring }: { offspring: RT_Offspring[] },
): Promise<{ body: { offspring: RT_Offspring[] } }[]> =>
  Promise.resolve([{ body: { offspring } }]);

const wrapReportsBodyAdapter = (
  { reports }: { reports: RT_Report[] },
): Promise<{ body: { reports: RT_Report[] } }[]> =>
  Promise.resolve([{ body: { reports } }]);

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
    ReproductionTracking.addMother,
    { user: authUser, motherId },
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
    ReproductionTracking.addMother,
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
    ReproductionTracking.addMother,
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
    ReproductionTracking.removeMother,
    { user: authUser, motherId },
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
    ReproductionTracking.removeMother,
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
    ReproductionTracking.removeMother,
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
  {
    request,
    token,
    authUser,
    motherId,
    fatherId,
    birthDateStr,
    reportedLitterSize,
    notes,
    parsedDate,
  },
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

    frames = await frames.query(
      dateParserAdapter,
      { dateString: birthDateStr },
      { parsedDate },
    );
    return frames.filter(($) => $[parsedDate]); // Ensure date parsing succeeded
  },
  then: actions([
    ReproductionTracking.recordLitter,
    {
      user: authUser,
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
    {
      path: "/ReproductionTracking/recordLitter",
      birthDate: birthDateStr,
      token,
    },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(
      dateParserAdapter,
      { dateString: birthDateStr },
      { error: parseError },
    );
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
    ReproductionTracking.recordLitter,
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
    ReproductionTracking.recordLitter,
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
  {
    request,
    token,
    authUser,
    litterId,
    motherId,
    fatherId,
    birthDateStr,
    reportedLitterSize,
    notes,
    parsedDate,
  },
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
    const framesWithBirthDate = frames.filter(($) =>
      $[birthDateStr] !== undefined
    );
    if (framesWithBirthDate.length > 0) {
      frames = await framesWithBirthDate.query(dateParserAdapter, {
        dateString: birthDateStr,
      }, { parsedDate });
      frames = frames.filter(($) => $[parsedDate]); // Ensure date parsing succeeded
    }
    return frames;
  },
  then: actions([
    ReproductionTracking.updateLitter,
    {
      user: authUser,
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
    {
      path: "/ReproductionTracking/updateLitter",
      birthDate: birthDateStr,
      token,
    },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Only attempt to parse if birthDateStr was provided in the request
    const framesWithBirthDate = frames.filter(($) =>
      $[birthDateStr] !== undefined
    );
    if (framesWithBirthDate.length > 0) {
      const parsedFrames = await framesWithBirthDate.query(dateParserAdapter, {
        dateString: birthDateStr,
      }, { error: parseError });
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
    ReproductionTracking.updateLitter,
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
    ReproductionTracking.updateLitter,
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
    ReproductionTracking.recordOffspring,
    { user: authUser, litterId, offspringId, sex, notes },
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
    ReproductionTracking.recordOffspring,
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
    ReproductionTracking.recordOffspring,
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
  {
    request,
    token,
    authUser,
    oldOffspringId,
    newOffspringId,
    litterId,
    sex,
    notes,
  },
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
    ReproductionTracking.updateOffspring,
    { user: authUser, oldOffspringId, newOffspringId, litterId, sex, notes },
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
    ReproductionTracking.updateOffspring,
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
    ReproductionTracking.updateOffspring,
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
    ReproductionTracking.recordWeaning,
    { user: authUser, offspringId },
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
    ReproductionTracking.recordWeaning,
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
    ReproductionTracking.recordWeaning,
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
    ReproductionTracking.recordDeath,
    { user: authUser, offspringId },
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
    ReproductionTracking.recordDeath,
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
    ReproductionTracking.recordDeath,
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
  {
    request,
    token,
    authUser,
    target,
    startDateRangeStr,
    endDateRangeStr,
    name,
    parsedStartDate,
    parsedEndDate,
  },
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

    frames = await frames.query(dateParserAdapter, {
      dateString: startDateRangeStr,
    }, { parsedDate: parsedStartDate });
    frames = frames.filter(($) => $[parsedStartDate]);
    if (frames.length === 0) return frames; // Stop if start date parsing failed

    frames = await frames.query(dateParserAdapter, {
      dateString: endDateRangeStr,
    }, { parsedDate: parsedEndDate });
    return frames.filter(($) => $[parsedEndDate]); // Ensure end date parsing succeeded
  },
  then: actions([
    ReproductionTracking.generateReport,
    {
      user: authUser,
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
  {
    request,
    token,
    authUser,
    startDateRangeStr,
    endDateRangeStr,
    parseError,
    parsedStartDate,
  },
) => ({
  when: actions([
    Requesting.request,
    {
      path: "/ReproductionTracking/generateReport",
      startDateRange: startDateRangeStr,
      endDateRange: endDateRangeStr,
      token,
    },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    // Check start date parse first
    frames = await frames.query(dateParserAdapter, {
      dateString: startDateRangeStr,
    }, { error: parseError, parsedDate: parsedStartDate });
    const startDateFailed = frames.filter(($) => $[parseError] !== undefined);
    if (startDateFailed.length > 0) return startDateFailed;

    // Then check end date parse for successful start date frames
    const startDateSuccessFrames = frames.filter(($) =>
      $[parsedStartDate] !== undefined
    );
    if (startDateSuccessFrames.length > 0) {
      frames = await startDateSuccessFrames.query(dateParserAdapter, {
        dateString: endDateRangeStr,
      }, { error: parseError });
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
    ReproductionTracking.generateReport,
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
    ReproductionTracking.generateReport,
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
    ReproductionTracking.renameReport,
    { user: authUser, oldName, newName },
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
    ReproductionTracking.renameReport,
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
    ReproductionTracking.renameReport,
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
    ReproductionTracking.deleteReport,
    { user: authUser, reportName },
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
    ReproductionTracking.deleteReport,
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
    ReproductionTracking.deleteReport,
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
  {
    request,
    token,
    authUser,
    reportName,
    resultsOutput,
    queryError,
    resultsBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport", reportName, token },
    { request },
  ]),
  where: async (frames) => {
    // Need to re-authenticate here too because this sync needs a `authUser` binding
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    // Re-run the query adapter to get the results/error symbols for this specific response sync
    frames = await frames.query(rt_viewReportAdapter, {
      user: authUser,
      reportName,
    }, { results: resultsOutput, error: queryError });
    frames = frames.filter(($) => $[resultsOutput] !== undefined); // Only keep frames with actual results

    // Wrap into top-level body symbol
    frames = await frames.query(wrapResultsBodyAdapter, {
      results: resultsOutput,
    }, { body: resultsBody });
    return frames.filter(($) => $[resultsBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: resultsBody },
  ]),
});

export const ViewReport_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reportName,
    resultsOutput,
    conceptError,
    errorBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_viewReport", reportName, token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    // Re-run the query adapter to get the results/error symbols
    frames = await frames.query(rt_viewReportAdapter, {
      user: authUser,
      reportName,
    }, { results: resultsOutput, error: conceptError });
    frames = frames.filter(($) => $[conceptError] !== undefined); // Only keep frames with an error

    // Wrap error into top-level body symbol
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: conceptError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: errorBody },
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
  {
    request,
    token,
    authUser,
    reportName,
    summaryOutput,
    queryError,
    summaryBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary", reportName, token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_aiSummaryAdapter, {
      user: authUser,
      reportName,
    }, { summary: summaryOutput, error: queryError });
    frames = frames.filter(($) => $[summaryOutput] !== undefined);

    // Wrap summary into top-level body symbol
    frames = await frames.query(wrapSummaryBodyAdapter, {
      summary: summaryOutput,
    }, { body: summaryBody });
    return frames.filter(($) => $[summaryBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: summaryBody },
  ]),
});

export const AISummary_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reportName,
    summaryOutput,
    conceptError,
    errorBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_aiSummary", reportName, token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_aiSummaryAdapter, {
      user: authUser,
      reportName,
    }, { summary: summaryOutput, error: conceptError });
    frames = frames.filter(($) => $[conceptError] !== undefined);

    // Wrap error into top-level body symbol
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: conceptError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: errorBody },
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
    ReproductionTracking.regenerateAISummary,
    { user: authUser, reportName },
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
    ReproductionTracking.regenerateAISummary,
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
    ReproductionTracking.regenerateAISummary,
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
  {
    request,
    token,
    authUser,
    mothersOutput,
    queryError,
    mothersBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers", token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listMothersAdapter, { user: authUser }, {
      mother: mothersOutput,
      error: queryError,
    });
    frames = frames.filter(($) => $[mothersOutput] !== undefined);

    // Wrap into body symbol
    frames = await frames.query(wrapMothersBodyAdapter, {
      mothers: mothersOutput,
    }, { body: mothersBody });
    return frames.filter(($) => $[mothersBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: mothersBody },
  ]),
});

export const ListMothers_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    mothersOutput,
    conceptError,
    errorBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listMothers", token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listMothersAdapter, { user: authUser }, {
      mother: mothersOutput,
      error: conceptError,
    });
    frames = frames.filter(($) => $[conceptError] !== undefined);

    // Wrap error
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: conceptError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: errorBody },
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
  {
    request,
    token,
    authUser,
    motherId,
    littersOutput,
    queryError,
    littersBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother", motherId, token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listLittersByMotherAdapter, {
      user: authUser,
      motherId,
    }, { litter: littersOutput, error: queryError });
    frames = frames.filter(($) => $[littersOutput] !== undefined);

    // Wrap into body symbol
    frames = await frames.query(wrapLittersBodyAdapter, {
      litters: littersOutput,
    }, { body: littersBody });
    return frames.filter(($) => $[littersBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: littersBody },
  ]),
});

export const ListLittersByMother_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    motherId,
    littersOutput,
    conceptError,
    errorBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listLittersByMother", motherId, token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listLittersByMotherAdapter, {
      user: authUser,
      motherId,
    }, { litter: littersOutput, error: conceptError });
    frames = frames.filter(($) => $[conceptError] !== undefined);

    // Wrap error
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: conceptError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: errorBody },
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
  {
    request,
    token,
    authUser,
    litterId,
    offspringOutput,
    queryError,
    offspringBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter", litterId, token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listOffspringByLitterAdapter, {
      user: authUser,
      litterId,
    }, { offspring: offspringOutput, error: queryError });
    frames = frames.filter(($) => $[offspringOutput] !== undefined);

    // Wrap into body symbol
    frames = await frames.query(wrapOffspringBodyAdapter, {
      offspring: offspringOutput,
    }, { body: offspringBody });
    return frames.filter(($) => $[offspringBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: offspringBody },
  ]),
});

export const ListOffspringByLitter_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    litterId,
    offspringOutput,
    conceptError,
    errorBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listOffspringByLitter", litterId, token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, {
      user: authUser,
    });
    frames = frames.filter(($) => $[authUser]);
    frames = await frames.query(rt_listOffspringByLitterAdapter, {
      user: authUser,
      litterId,
    }, { offspring: offspringOutput, error: conceptError });
    frames = frames.filter(($) => $[conceptError] !== undefined);

    // Wrap error
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: conceptError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: errorBody },
  ]),
});

// --- _listReports (Query) ---
export const ListReports_Call_Concept: Sync = (
  { request, token, authUser },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listReports", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    return frames.filter(($) => $[authUser]);
  },
  then: [],
});

export const ListReports_Respond_Auth_Error: Sync = (
  { request, token, authError },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listReports", token },
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

export const ListReports_Respond_Success: Sync = (
  {
    request,
    token,
    authUser,
    reportsOutput,
    queryError,
    listReportsBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listReports", token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listReportsAdapter, { user: authUser }, {
      report: reportsOutput,
      error: queryError,
    });
    frames = frames.filter(($) => $[reportsOutput] !== undefined);

    // Wrap into body symbol
    frames = await frames.query(wrapReportsBodyAdapter, {
      reports: reportsOutput,
    }, { body: listReportsBody });
    return frames.filter(($) => $[listReportsBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: listReportsBody },
  ]),
});

export const ListReports_Respond_Concept_Error: Sync = (
  {
    request,
    token,
    authUser,
    reportsOutput,
    conceptError,
    errorBody,
  },
) => ({
  when: actions([
    Requesting.request,
    { path: "/ReproductionTracking/_listReports", token },
    { request },
  ]),
  where: async (frames) => {
    // Re-authenticate
    frames = await frames.query(verifyAdapter, { token }, { user: authUser });
    frames = frames.filter(($) => $[authUser]);

    frames = await frames.query(rt_listReportsAdapter, { user: authUser }, {
      report: reportsOutput,
      error: conceptError,
    });
    frames = frames.filter(($) => $[conceptError] !== undefined);

    // Wrap error
    frames = await frames.query(wrapErrorBodyAdapter, {
      error: conceptError,
    }, { body: errorBody });
    return frames.filter(($) => $[errorBody] !== undefined);
  },
  then: actions([
    Requesting.respond,
    { request, body: errorBody },
  ]),
});
