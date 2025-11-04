---
timestamp: 'Mon Nov 03 2025 21:26:22 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_212622.c7190457.md]]'
content_id: cf603b3b35ac2c87975162e309eaebda92cd96b34b6b1c5acef1ada4b70f9441
---

# Prompt: Please write syncs for each of the actions and queries of the ReproductionTracking concept so that when a path of the format "/ReproductionTracking/ACTION" where ACTION is the action or query in question is called with the arguments to the action, a call is made to UserAuthentication.verify to verify the token and get a user, and then call the action with that user. Separate responses into success and fail responses. Make sure that the expected fields in the sync are exactly the inputs to the action associated with that sync. Use adapters for queries and for verifying a user, here is an example adapter for verifying a user. Look to the growth syncs as an example.

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
