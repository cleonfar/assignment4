---
timestamp: 'Sun Nov 02 2025 16:22:37 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_162237.1f47a7ee.md]]'
content_id: d70e7b52f4a7f4ed15a68850deda6b4efc07d648b3f86268fef3edd687bc356c
---

# Prompt: Rewrite the syncs to use verifyAdapter

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
