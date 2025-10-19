---
timestamp: 'Fri Oct 17 2025 22:58:22 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_225822.0c98ed65.md]]'
content_id: 6d72a39a1373d97e593a8b679db958f524e1ee37c0ef8774dd08f18ba83dc7a1
---

# Prompt: We're also failing this test case

HerdGroupingConcept ... splitHerd: should return error if any animal not in source => ./src/concepts/HerdGrouping/HerdGroupingConcept.test.ts:432:11
error: AssertionError: Values are not equal.

```
[Diff] Actual / Expected
```

* Animals animal:001, animal:004 are not members of the source herd 'Pasture A'.

- Animals animal:001 are not members of the source herd 'Pasture A'.

throw new AssertionError(message);
^
at assertEquals (https://jsr.io/@std/assert/1.0.7/equals.ts:51:9)
at file:///C:/Users/cleon/assignment4/src/concepts/HerdGrouping/HerdGroupingConcept.test.ts:445:7
at eventLoopTick (ext:core/01\_core.js:179:7)
at async innerWrapped (ext:cli/40\_test.js:181:5)
at async exitSanitizer (ext:cli/40\_test.js:97:27)
at async Object.outerWrapped \[as fn] (ext:cli/40\_test.js:124:14)
at async TestContext.step (ext:cli/40\_test.js:511:22)
at async file:///C:/Users/cleon/assignment4/src/concepts/HerdGrouping/HerdGroupingConcept.test.ts:432:3
