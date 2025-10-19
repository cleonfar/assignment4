---
timestamp: 'Thu Oct 16 2025 14:21:31 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_142131.130b8720.md]]'
content_id: 63dd6b4577e2b521ac66ebc067895f9e03ccd9c6b1994c1541d74a9568a700eb
---

# Prompt: Many errors. First off, there are lots of errors with type string not assignable to type ID and type ID not assignable to parameter of type ObjectID. As a reminder, this is the definition of ID as given in utils/types.ts

declare const Brand: unique symbol;

/\*\*

* Generic ID: effectively a string,
* but uses type branding.
  \*/
  export type ID = string & { \[Brand]: true };
