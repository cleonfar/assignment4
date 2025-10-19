---
timestamp: 'Fri Oct 17 2025 23:08:24 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_230824.409bee88.md]]'
content_id: f68edf99d6500d170a5e5bef70fc0bea425fc2bc0cb16585563f6b8d70c7d52a
---

# response:

You are absolutely correct. My apologies for misinterpreting that nuance. In herd management, if you intend to split animals, you definitely want to ensure those animals are actually present in the source herd before attempting the split. Failing with an error in that scenario is much safer and clearer behavior.

We will revert the "lenient source" behavior for `splitHerd` and make it strictly check that all animals intended for splitting are present in the `sourceHerd`. The "lenient target" behavior (not complaining if an animal is already in the target herd) will remain, as it's handled by `$addToSet` and generally useful.

This requires changes in the concept specification, implementation, and a significant adjustment to the test file.

***

### 1. Revised Concept Specification for `splitHerd`

I'm restoring the strict precondition for the source herd in the `splitHerd` action.
