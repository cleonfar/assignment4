import { actions, Frames, Sync } from "@engine";
import { AnimalIdentity, Requesting, UserAuthentication } from "@concepts";
import { ID } from "@utils/types.ts";

// Parse a date field in frames if it is a string
function parseDateIfString(frames: Frames, dateVar: symbol): Frames {
  return frames.map(($) => {
    const v = $[dateVar];
    if (typeof v === "string") {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return { ...$, [dateVar]: d };
    }
    return $;
  });
}

// Helper adapter for UserAuthentication.verify to fit frames.query
// It will always return an array with one element: either { user: ID } or { error: string }
const verifyAdapter = async (
  { sessionToken }: { sessionToken: string },
): Promise<({ user: ID } | { error: string })[]> => {
  const result = await UserAuthentication.verify({ token: sessionToken });
  if ("user" in result) {
    return [{ user: result.user as ID }];
  }
  if ("error" in result) {
    return [{ error: result.error }];
  }
  return [];
};

// Adapters for AnimalIdentity queries, ensuring they always return an array
const getAnimalAdapter = async (
  { user, id }: { user: ID; id: ID },
): Promise<({ animal: unknown } | { error: string })[]> => {
  const result = await AnimalIdentity._getAnimal({ user, id });
  if ("error" in result) return [{ error: result.error }];
  return [{ animal: result.animal }];
};
const getAllAnimalsAdapter = async (
  { user }: { user: ID },
): Promise<({ animals: unknown[] } | { error: string })[]> => {
  const result = await AnimalIdentity._getAllAnimals({ user });
  if ("error" in result) return [{ error: result.error }];
  return [{ animals: result.animals }];
};

export const RegisterAnimalRequest: Sync = ({
  request,
  token,
  id,
  species,
  sex,
  birthDate,
  breed, // This variable will capture 'breed' if present in the incoming request
  notes, // This variable will capture 'notes' if present in the incoming request
  user,
  authError,
}) => ({
  when: actions([
    Requesting.request,
    {
      path: "/AnimalIdentity/registerAnimal",
      token,
      id,
      species,
      sex,
      birthDate, // birthDate is still required by this pattern
      breed,
      notes,
      // breed and notes are intentionally omitted from this input pattern
      // making them optional for the incoming request
    },
    { request }, // <--- NOW IN THE OUTPUT PATTERN: captures them if they exist
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, {
      sessionToken: token,
    }, { user, error: authError });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return parseDateIfString(frames, birthDate);
  },
  then: actions(
    [AnimalIdentity.registerAnimal, {
      user,
      id,
      species,
      sex,
      birthDate,
      breed, // Will be `undefined` if not provided in the Requesting.request,
      // which the AnimalIdentityConcept.registerAnimal correctly handles.
      notes, // Will be `undefined` if not provided in the Requesting.request,
      // which the AnimalIdentityConcept.registerAnimal correctly handles.
    }],
  ),
});

export const RegisterAnimalResponseSuccess: Sync = ({ request, animal }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/registerAnimal" }, {
      request,
    }],
    [AnimalIdentity.registerAnimal, {}, { animal }],
  ),
  then: actions(
    [Requesting.respond, { request, animal }],
  ),
});

export const RegisterAnimalResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/registerAnimal" }, {
      request,
    }],
    [AnimalIdentity.registerAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- updateStatus ---
export const UpdateAnimalStatusRequest: Sync = ({
  request,
  token, // Changed from session to token
  animal,
  status,
  notes,
  user,
  authError,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/updateStatus", token, animal, status, notes }, // Match incoming 'token' parameter
    { request },
  ]),
  where: async (frames) => {
    // Pass the local 'token' variable
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return frames;
  },
  then: actions(
    [AnimalIdentity.updateStatus, { user, animal, status, notes }],
  ),
});

export const UpdateAnimalStatusResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/updateStatus" }, {
      request,
    }],
    [AnimalIdentity.updateStatus, {}, {}], // Empty result for success
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }], // Respond with a success indicator
  ),
});

export const UpdateAnimalStatusResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/updateStatus" }, {
      request,
    }],
    [AnimalIdentity.updateStatus, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- editDetails ---
export const EditAnimalDetailsRequest: Sync = ({
  request,
  token, // Changed from session to token
  animal,
  species,
  breed,
  birthDate,
  sex,
  user,
  authError,
}) => ({
  when: actions([
    Requesting.request,
    {
      path: "/AnimalIdentity/editDetails",
      token, // Match incoming 'token' parameter
      animal,
      species,
      breed,
      birthDate,
      sex,
    },
    { request },
  ]),
  where: async (frames) => {
    // Pass the local 'token' variable
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return parseDateIfString(frames, birthDate);
  },
  then: actions(
    [AnimalIdentity.editDetails, {
      user,
      animal,
      species,
      breed,
      birthDate,
      sex,
    }],
  ),
});

export const EditAnimalDetailsResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/editDetails" }, {
      request,
    }],
    [AnimalIdentity.editDetails, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const EditAnimalDetailsResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/editDetails" }, {
      request,
    }],
    [AnimalIdentity.editDetails, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- markAsTransferred ---
export const MarkAnimalAsTransferredRequest: Sync = ({
  request,
  token, // Changed from session to token
  animal,
  date,
  recipientNotes,
  user,
  authError,
}) => ({
  when: actions([
    Requesting.request,
    {
      path: "/AnimalIdentity/markAsTransferred",
      token, // Match incoming 'token' parameter
      animal,
      date,
      recipientNotes,
    },
    { request },
  ]),
  where: async (frames) => {
    // Pass the local 'token' variable
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return parseDateIfString(frames, date);
  },
  then: actions(
    [AnimalIdentity.markAsTransferred, { user, animal, date, recipientNotes }],
  ),
});

export const MarkAnimalAsTransferredResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsTransferred" }, {
      request,
    }],
    [AnimalIdentity.markAsTransferred, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const MarkAnimalAsTransferredResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsTransferred" }, {
      request,
    }],
    [AnimalIdentity.markAsTransferred, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- markAsDeceased ---
export const MarkAnimalAsDeceasedRequest: Sync = ({
  request,
  token, // Changed from session to token
  animal,
  date,
  cause,
  user,
  authError,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/markAsDeceased", token, animal, date, cause }, // Match incoming 'token' parameter
    { request },
  ]),
  where: async (frames) => {
    // Pass the local 'token' variable
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return parseDateIfString(frames, date);
  },
  then: actions(
    [AnimalIdentity.markAsDeceased, { user, animal, date, cause }],
  ),
});

export const MarkAnimalAsDeceasedResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsDeceased" }, {
      request,
    }],
    [AnimalIdentity.markAsDeceased, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const MarkAnimalAsDeceasedResponseError: Sync = (
  { request, error },
) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsDeceased" }, {
      request,
    }],
    [AnimalIdentity.markAsDeceased, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- markAsSold ---
export const MarkAnimalAsSoldRequest: Sync = ({
  request,
  token, // Changed from session to token
  animal,
  date,
  buyerNotes,
  user,
  authError,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/markAsSold", token, animal, date, buyerNotes }, // Match incoming 'token' parameter
    { request },
  ]),
  where: async (frames) => {
    // Pass the local 'token' variable
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return parseDateIfString(frames, date);
  },
  then: actions(
    [AnimalIdentity.markAsSold, { user, animal, date, buyerNotes }],
  ),
});

export const MarkAnimalAsSoldResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const MarkAnimalAsSoldResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/markAsSold" }, { request }],
    [AnimalIdentity.markAsSold, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- removeAnimal ---
export const RemoveAnimalRequest: Sync = ({
  request,
  token, // Changed from session to token
  animal,
  user,
  authError,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/removeAnimal", token, animal }, // Match incoming 'token' parameter
    { request },
  ]),
  where: async (frames) => {
    // Pass the local 'token' variable
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    return frames;
  },
  then: actions(
    [AnimalIdentity.removeAnimal, { user, animal }],
  ),
});

export const RemoveAnimalResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/removeAnimal" }, { request }],
    [AnimalIdentity.removeAnimal, {}, {}],
  ),
  then: actions(
    [Requesting.respond, { request, status: "success" }],
  ),
});

export const RemoveAnimalResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/AnimalIdentity/removeAnimal" }, { request }],
    [AnimalIdentity.removeAnimal, {}, { error }],
  ),
  then: actions(
    [Requesting.respond, { request, error }],
  ),
});

// --- _getAnimal Query ---
export const GetAnimalRequestSuccess: Sync = ({
  request,
  token, // Changed from session to token
  id,
  user,
  authError,
  animal,
  error,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/_getAnimal", token, id }, // Match incoming 'token' parameter
    { request },
  ]),
  where: async (frames) => {
    // Pass the local 'token' variable
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    frames = await frames.query(getAnimalAdapter, { user, id }, {
      animal,
      error, // Bind specific AnimalIdentity error
    });
    // Only keep success frames (animal present, no error)
    return frames.filter(($) =>
      $[animal] !== undefined && $[error] === undefined
    );
  },
  then: actions(
    [Requesting.respond, { request, animal }],
  ),
});

// --- _getAllAnimals Query ---
export const GetAnimalRequestError: Sync = ({
  request,
  token,
  id,
  user,
  authError,
  animal,
  error,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/_getAnimal", token, id },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    frames = await frames.query(getAnimalAdapter, { user, id }, {
      animal,
      error,
    });
    // Only keep error frames (error present)
    return frames.filter(($) => $[error] !== undefined);
  },
  then: actions([Requesting.respond, { request, error }]),
});

// --- _getAllAnimals Query ---
export const GetAllAnimalsRequestSuccess: Sync = ({
  request,
  token, // Changed from session to token
  user,
  authError,
  animals,
  error,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/_getAllAnimals", token }, // Match incoming 'token' parameter
    { request },
  ]),
  where: async (frames) => {
    // Pass the local 'token' variable
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    frames = await frames.query(getAllAnimalsAdapter, { user }, {
      animals,
      error, // Bind specific AnimalIdentity error
    });
    // Only keep success frames (animals present, no error)
    return frames.filter(($) =>
      $[animals] !== undefined && $[error] === undefined
    );
  },
  then: actions(
    [Requesting.respond, { request, animals }],
  ),
});

export const GetAllAnimalsRequestError: Sync = ({
  request,
  token,
  user,
  authError,
  animals,
  error,
}) => ({
  when: actions([
    Requesting.request,
    { path: "/AnimalIdentity/_getAllAnimals", token },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(verifyAdapter, { sessionToken: token }, {
      user,
      error: authError,
    });

    frames = frames.filter(($) =>
      $[user] !== undefined && $[authError] === undefined
    );
    if (frames.length === 0) return frames;

    frames = await frames.query(getAllAnimalsAdapter, { user }, {
      animals,
      error,
    });
    // Only keep error frames (error present)
    return frames.filter(($) => $[error] !== undefined);
  },
  then: actions([Requesting.respond, { request, error }]),
});
