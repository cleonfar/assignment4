---
timestamp: 'Thu Oct 16 2025 18:32:44 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_183244.09d5c5dc.md]]'
content_id: baac2518ad47d9f27bef402aa0d831db4dd0a8c284e686363dc5bed0348ebb24
---

# Prompt: Hey I'm not getting this issue on a few test cases

ReproductionTrackingConcept - addMother action => ./src/concepts/ReproductionTracking/ReproductionTrackingConcept.test.ts:9:6
error: Leaks detected:

* A TLS connection was opened/accepted during the test, but not closed during the test. Close the TLS connection by calling `tlsConn.close()`.
* An async call to op\_read was started in this test, but never completed.
  To get more details where leaks occurred, run again with the --trace-leaks flag.
