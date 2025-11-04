---
timestamp: 'Sun Nov 02 2025 16:28:06 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_162806.54370242.md]]'
content_id: 53450e85c7da2da4cbd65c0fd579f986cf2c7549cabd5dccc3122e3b6a88df58
---

# Prompt: Rewrite the syncs to use verifyAdapter. Below is the implementation of verifyAdapter and an example of a sync for a different concept using verifyAdapter

// Helper adapter for UserAuthentication.verify to fit frames.query
// It will always return an array with one element: either { user: ID } or { error: string }
const verifyAdapter = async (
{ sessionToken }: { sessionToken: string },
): Promise<({ user: ID } | { error: string })\[]> => {
const result = await UserAuthentication.verify({ token: sessionToken });
if ("user" in result) {
return \[{ user: result.user as ID }];
}
if ("error" in result) {
return \[{ error: result.error }];
}
return \[];
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
when: actions(\[
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

```
frames = frames.filter(($) =>
  $[user] !== undefined && $[authError] === undefined
);
if (frames.length === 0) return frames;

return parseDateIfString(frames, birthDate);
```

},
then: actions(
\[AnimalIdentity.registerAnimal, {
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
\[Requesting.request, { path: "/AnimalIdentity/registerAnimal" }, {
request,
}],
\[AnimalIdentity.registerAnimal, {}, { animal }],
),
then: actions(
\[Requesting.respond, { request, animal }],
),
});

export const RegisterAnimalResponseError: Sync = ({ request, error }) => ({
when: actions(
\[Requesting.request, { path: "/AnimalIdentity/registerAnimal" }, {
request,
}],
\[AnimalIdentity.registerAnimal, {}, { error }],
),
then: actions(
\[Requesting.respond, { request, error }],
),
});
