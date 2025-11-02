import { actions, Frames, Sync } from "@engine";
// Assuming concepts.ts or similar aggregates these
import { AnimalIdentity, Requesting, UserAuthentification } from "@concepts";
import { ID } from "@utils/types.ts";

// The user ID for AnimalIdentity is the username from UserAuthentication.
// We use type branding for clarity, but it's treated as a string value at runtime.
// Note: We bind engine variables (symbols) for user/ids; no local brand types needed here.

// --- User Authentication Syncs ---
// These syncs handle the full flow for user registration, login, and logout.
// Each request has a corresponding action sync and success/error response syncs.

// 1. Handle User Registration Request
export const RegisterUserRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, { path: "/register", username, password }, {
      request,
    }],
  ),
  then: actions(
    [UserAuthentification.register, { username, password }, {}], // Output `user` or `error` is handled by subsequent syncs
  ),
});

// 1.1 Respond to User Registration Success
export const RegisterUserResponseSuccess: Sync = (
  { request, user_auth_id, username_from_request },
) => ({
  when: actions(
    [Requesting.request, { path: "/register" }, { request }],
    [UserAuthentification.register, { username: username_from_request }, {
      user: user_auth_id,
    }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: {
        status: "success",
        userId: user_auth_id,
        username: username_from_request,
      },
    }],
  ),
});

// 1.2 Respond to User Registration Error
export const RegisterUserResponseError: Sync = (
  { request, error_message },
) => ({
  when: actions(
    [Requesting.request, { path: "/register" }, { request }],
    [UserAuthentification.register, {}, { error: error_message }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "error", message: error_message },
    }],
  ),
});

// 2. Handle User Login Request
export const LoginUserRequest: Sync = ({ request, username, password }) => ({
  when: actions(
    [Requesting.request, { path: "/login", username, password }, { request }],
  ),
  then: actions(
    [UserAuthentification.login, { username, password }, {}], // Output `token` or `error` is handled by subsequent syncs
  ),
});

// 2.1 Respond to User Login Success
export const LoginUserResponseSuccess: Sync = ({ request, token }) => ({
  when: actions(
    [Requesting.request, { path: "/login" }, { request }],
    [UserAuthentification.login, {}, { token }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "success", token: token },
    }],
  ),
});

// 2.2 Respond to User Login Error
export const LoginUserResponseError: Sync = ({ request, error_message }) => ({
  when: actions(
    [Requesting.request, { path: "/login" }, { request }],
    [UserAuthentification.login, {}, { error: error_message }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "error", message: error_message },
    }],
  ),
});

// 3. Handle User Logout Request
export const LogoutUserRequest: Sync = ({ request, session_token }) => ({
  when: actions(
    [Requesting.request, { path: "/logout", session: session_token }, {
      request,
    }],
  ),
  then: actions(
    [UserAuthentification.logout, { token: session_token }, {}], // Output (empty for success, or `error`) handled by subsequent syncs
  ),
});

// 3.1 Respond to User Logout Success
export const LogoutUserResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/logout" }, { request }],
    [UserAuthentification.logout, {}, {}], // Empty output signifies success
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "success", message: "Logged out." },
    }],
  ),
});

// 3.2 Respond to User Logout Error
export const LogoutUserResponseError: Sync = ({ request, error_message }) => ({
  when: actions(
    [Requesting.request, { path: "/logout" }, { request }],
    [UserAuthentification.logout, {}, { error: error_message }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "error", message: error_message },
    }],
  ),
});

// --- Animal Identity Syncs (integrating User Authentication) ---

// This pattern will be used for each AnimalIdentity action:
// 1. A "Process" sync that handles the incoming request, authenticates the user,
//    and then triggers the AnimalIdentity action if authentication succeeds.
//    If authentication fails, it binds an `auth_error_message` to the frame.
// 2. A "Success Response" sync that triggers `Requesting.respond` when the AnimalIdentity action succeeds.
// 3. An "Authentication Error Response" sync that triggers `Requesting.respond` when authentication fails.
// 4. A "Concept Error Response" sync that triggers `Requesting.respond` when the AnimalIdentity action returns an error.

// This verbose pattern clearly separates concerns for each outcome.

// 4. Register Animal Flow
export const RegisterAnimalProcess: Sync = ({
  request,
  session,
  id,
  species,
  sex,
  birthDate,
  breed,
  notes, // Inputs from request body
  username, // Output from UserAuthentication.verify
  auth_error_message, // Bound if authentication fails
  animal_id, // Output from AnimalIdentity.registerAnimal
  animal_concept_error, // Output from AnimalIdentity.registerAnimal if it fails
}) => ({
  when: actions(
    [Requesting.request, {
      path: "/animals/register",
      session,
      id,
      species,
      sex,
      birthDate,
      breed,
      notes,
    }, { request }],
  ),
  where: async (frames) => {
    const originalFrame = frames[0]; // Capture original request details for error responses
    const authenticatedFrames = await frames.query(
      async ({ token }: { token: string }) => {
        const result = await UserAuthentification.verify({ token });
        return "user" in result ? [result] : [];
      },
      { token: session },
      { user: username },
    );

    if (
      authenticatedFrames.length === 0 ||
      authenticatedFrames[0][username] === undefined
    ) {
      // Authentication failed. Return a frame with the error message.
      return new Frames({
        ...originalFrame,
        [auth_error_message]:
          "Authentication failed: Invalid or expired session.",
      });
    }
    // Authentication succeeded. The `username` is now bound in `authenticatedFrames`.
    return authenticatedFrames;
  },
  then: actions(
    // This `then` clause only fires if `username` is successfully bound (auth success).
    // It calls `AnimalIdentity.registerAnimal` and captures its `animal` ID or `error`.
    [AnimalIdentity.registerAnimal, {
      user: username, // bound from authentication
      id,
      species,
      sex,
      birthDate,
      breed,
      notes,
    }, { animal: animal_id, error: animal_concept_error }],
  ),
});

// 4.1 Respond to Register Animal (Success)
export const RespondRegisterAnimalSuccess: Sync = ({ request, animal_id }) => ({
  when: actions(
    [Requesting.request, { path: "/animals/register" }, { request }],
    // Match the successful output from the `then` clause of RegisterAnimalProcess
    [AnimalIdentity.registerAnimal, {}, { animal: animal_id }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "success", animalId: animal_id },
    }],
  ),
});

// 4.2 Respond to Register Animal (Authentication Error)
export const RespondRegisterAnimalAuthError: Sync = (
  { request, auth_error_message, animal_id, animal_concept_error },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals/register" }, { request }],
  ),
  where: (frames) => {
    // Filter frames to only include those where `auth_error_message` was set by `RegisterAnimalProcess`
    // AND where `AnimalIdentity.registerAnimal` did not produce a successful output (`animal_id`)
    // AND did not produce its own concept error (`animal_concept_error`).
    return frames.filter(($) =>
      $[auth_error_message] !== undefined &&
      $[animal_id] === undefined &&
      $[animal_concept_error] === undefined
    );
  },
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "error", message: auth_error_message },
    }],
  ),
});

// 4.3 Respond to Register Animal (Concept Error from AnimalIdentity)
export const RespondRegisterAnimalConceptError: Sync = (
  { request, animal_concept_error },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals/register" }, { request }],
    // Match when AnimalIdentity.registerAnimal returned an error
    [AnimalIdentity.registerAnimal, {}, { error: animal_concept_error }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "error", message: animal_concept_error },
    }],
  ),
});

// 5. Get All Animals Flow
export const GetAllAnimalsProcess: Sync = ({
  request,
  session,
  username,
  auth_error_message,
  animals_list, // Output from AnimalIdentity._getAllAnimals
  animal_concept_error, // Output from AnimalIdentity._getAllAnimals if it fails
}) => ({
  when: actions(
    [Requesting.request, { path: "/animals", session }, { request }],
  ),
  where: async (frames) => {
    const originalFrame = frames[0];
    const authenticatedFrames = await frames.query(
      async ({ token }: { token: string }) => {
        const result = await UserAuthentification.verify({ token });
        return "user" in result ? [result] : [];
      },
      { token: session },
      { user: username },
    );

    if (
      authenticatedFrames.length === 0 ||
      authenticatedFrames[0][username] === undefined
    ) {
      // Authentication failed.
      return new Frames({
        ...originalFrame,
        [auth_error_message]:
          "Authentication failed: Invalid or expired session.",
      });
    }
    // Authentication succeeded.
    return authenticatedFrames;
  },
  then: actions(
    // This `then` fires if auth succeeded. It queries for animals.
    // It captures both the list of animals or an error from the query.
    [AnimalIdentity._getAllAnimals, { user: username }, {
      animals: animals_list,
      error: animal_concept_error,
    }],
  ),
});

// 5.1 Respond to Get All Animals (Success)
export const RespondGetAllAnimalsSuccess: Sync = (
  { request, animals_list },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals" }, { request }],
    [AnimalIdentity._getAllAnimals, {}, { animals: animals_list }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "success", animals: animals_list },
    }],
  ),
});

// 5.2 Respond to Get All Animals (Authentication Error)
export const RespondGetAllAnimalsAuthError: Sync = (
  { request, auth_error_message, animals_list, animal_concept_error },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals" }, { request }],
  ),
  where: (frames) => {
    // Filter frames to only include those where `auth_error_message` was set by `GetAllAnimalsProcess`
    // AND where `AnimalIdentity._getAllAnimals` did not produce results (`animals_list`)
    // AND did not produce its own concept error (`animal_concept_error`).
    return frames.filter(($) =>
      $[auth_error_message] !== undefined &&
      $[animals_list] === undefined &&
      $[animal_concept_error] === undefined
    );
  },
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "error", message: auth_error_message },
    }],
  ),
});

// 5.3 Respond to Get All Animals (Concept Error from AnimalIdentity Query)
export const RespondGetAllAnimalsConceptError: Sync = (
  { request, animal_concept_error },
) => ({
  when: actions(
    [Requesting.request, { path: "/animals" }, { request }],
    [AnimalIdentity._getAllAnimals, {}, { error: animal_concept_error }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "error", message: animal_concept_error },
    }],
  ),
});

// 6. Get Specific Animal Flow (path: /animals/:id)
export const GetSpecificAnimalProcess: Sync = ({
  request,
  session,
  animal_id_param, // Captured from path, e.g., `/animals/animal123` -> `animal123`
  id,
  username,
  auth_error_message,
  animal_document, // Output from AnimalIdentity._getAnimal
  animal_concept_error, // Output from AnimalIdentity._getAnimal if it fails
}) => ({
  when: actions(
    [Requesting.request, { path: { "$regex": "^/animals/[^/]+$" }, session }, {
      request,
      path: animal_id_param,
    }], // Match /animals/ID
  ),
  where: async (frames) => {
    const originalFrame = frames[0];
    // Extract animal ID from the path variable (e.g., /animals/my-animal-id)
    const pathStr = originalFrame[animal_id_param] as string;
    const extractedId = (pathStr.split("/").pop() || "") as ID;
    frames = frames.map((f) => ({ ...f, id: extractedId })); // Add 'id' to the frame

    const authenticatedFrames = await frames.query(
      async ({ token }: { token: string }) => {
        const result = await UserAuthentification.verify({ token });
        return "user" in result ? [result] : [];
      },
      { token: session },
      { user: username },
    );

    if (
      authenticatedFrames.length === 0 ||
      authenticatedFrames[0][username] === undefined
    ) {
      // Authentication failed.
      return new Frames({
        ...originalFrame,
        [auth_error_message]:
          "Authentication failed: Invalid or expired session.",
      });
    }
    // Authentication succeeded.
    return authenticatedFrames;
  },
  then: actions(
    // Query for the specific animal document for the authenticated user.
    [AnimalIdentity._getAnimal, {
      user: username,
      id,
    }, { animal: animal_document, error: animal_concept_error }],
  ),
});

// 6.1 Respond to Get Specific Animal (Success)
export const RespondGetSpecificAnimalSuccess: Sync = (
  { request, animal_document },
) => ({
  when: actions(
    [Requesting.request, { path: { "$regex": "^/animals/[^/]+$" } }, {
      request,
    }],
    [AnimalIdentity._getAnimal, {}, { animal: animal_document }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "success", animal: animal_document },
    }],
  ),
});

// 6.2 Respond to Get Specific Animal (Authentication Error)
export const RespondGetSpecificAnimalAuthError: Sync = (
  { request, auth_error_message, animal_document, animal_concept_error },
) => ({
  when: actions(
    [Requesting.request, { path: { "$regex": "^/animals/[^/]+$" } }, {
      request,
    }],
  ),
  where: (frames) => {
    return frames.filter(($) =>
      $[auth_error_message] !== undefined &&
      $[animal_document] === undefined &&
      $[animal_concept_error] === undefined
    );
  },
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "error", message: auth_error_message },
    }],
  ),
});

// 6.3 Respond to Get Specific Animal (Concept Error from AnimalIdentity Query)
export const RespondGetSpecificAnimalConceptError: Sync = (
  { request, animal_concept_error },
) => ({
  when: actions(
    [Requesting.request, { path: { "$regex": "^/animals/[^/]+$" } }, {
      request,
    }],
    [AnimalIdentity._getAnimal, {}, { error: animal_concept_error }],
  ),
  then: actions(
    [Requesting.respond, {
      request,
      body: { status: "error", message: animal_concept_error },
    }],
  ),
});
