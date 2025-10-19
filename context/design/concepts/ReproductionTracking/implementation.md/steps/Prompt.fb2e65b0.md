---
timestamp: 'Thu Oct 16 2025 14:33:16 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_143316.a237b086.md]]'
content_id: fb2e65b0a454e63a92e623813153aa8cf7ff77212fc7e493248f885c2a9ff426
---

# Prompt: As a reminder, this is how the ID type is defined. It definitely seems to be confusing the test cases, so I would much rather just use a string for now if that's possible.

declare const Brand: unique symbol;

/\*\*

* Generic ID: effectively a string,
* but uses type branding.
  \*/
  export type ID = string & { \[Brand]: true };
