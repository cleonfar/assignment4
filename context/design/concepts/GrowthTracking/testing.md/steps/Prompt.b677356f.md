---
timestamp: 'Sat Oct 18 2025 15:56:45 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_155645.b5af62e9.md]]'
content_id: b677356f323c1d9af0ccdf17631ac15ecab8cb8bec6a3d5f6c4141451dd85177
---

# Prompt: When I run the test cases for recordWeight I get this error

GrowthTrackingConcept - recordWeight action ... should successfully record a weight for a new animal => ./src/concepts/GrowthTracking/GrowthTrackingConcept.test.ts:21:11
error: MongoServerError: Updating the path 'weightRecords' would create a conflict at 'weightRecords'
at UpdateOneOperation.execute (file:///C:/Users/cleon/assignment4/node\_modules/.deno/mongodb@6.10.0/node\_modules/mongodb/lib/operations/update.js:75:19)
at eventLoopTick (ext:core/01\_core.js:179:7)
at async tryOperation (file:///C:/Users/cleon/assignment4/node\_modules/.deno/mongodb@6.10.0/node\_modules/mongodb/lib/operations/execute\_operation.js:199:20)
at async executeOperation (file:///C:/Users/cleon/assignment4/node\_modules/.deno/mongodb@6.10.0/node\_modules/mongodb/lib/operations/execute\_operation.js:69:16)
at async Collection.updateOne (file:///C:/Users/cleon/assignment4/node\_modules/.deno/mongodb@6.10.0/node\_modules/mongodb/lib/collection.js:204:16)
at async GrowthTrackingConcept.recordWeight (file:///C:/Users/cleon/assignment4/src/concepts/GrowthTracking/GrowthTrackingConcept.ts:102:20)
at async file:///C:/Users/cleon/assignment4/src/concepts/GrowthTracking/GrowthTrackingConcept.test.ts:24:22
