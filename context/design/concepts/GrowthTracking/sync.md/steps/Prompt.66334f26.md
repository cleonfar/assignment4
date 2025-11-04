---
timestamp: 'Sun Nov 02 2025 19:25:43 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_192543.c586172a.md]]'
content_id: 66334f26230adb513f7c383c2fb4e88d860d9f67ecc554eecc7851a334674d85
---

# Prompt: Please write syncs for each of the actions and queries of the GrowthTracking concept so that when a path of the format "/GrowthTracking/ACTION" where ACTION is the action or query in question is called with the arguments to the action, a call is made to UserAuthentication.verify to verify the token and get a user, and then call the action with that user. Make sure that the expected fields in the sync are exactly the inputs to the action associated with that sync. Use adapters for queries and for verifying a user, here is an example adapter for verifying a user

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
return \[]; // Should ideally not be reached if verify always returns user or error
};
