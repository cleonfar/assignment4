---
timestamp: 'Fri Oct 17 2025 23:12:21 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_231221.af61347d.md]]'
content_id: 81a27076bdef54e28de31b8b9da491a237ce0f3f8d29e649310cf44b53d030f5
---

# Prompt: We're now failing only one test, with this error message. Any guesses why?

HerdGroupingConcept ... \_listHerds: should return all current herds => ./src/concepts/HerdGrouping/HerdGroupingConcept.test.ts:833:11
error: AssertionError: Values are not equal.

```
[Diff] Actual / Expected
```

* 4

- 3

throw new AssertionError(message);
^
at assertEquals (https://jsr.io/@std/assert/1.0.7/equals.ts:51:9)
at file:///C:/Users/cleon/assignment4/src/concepts/HerdGrouping/HerdGroupingConcept.test.ts:836:5
at eventLoopTick (ext:core/01\_core.js:179:7)
at async innerWrapped (ext:cli/40\_test.js:181:5)
at async exitSanitizer (ext:cli/40\_test.js:97:27)
at async Object.outerWrapped \[as fn] (ext:cli/40\_test.js:124:14)
at async TestContext.step (ext:cli/40\_test.js:511:22)
at async file:///C:/Users/cleon/assignment4/src/concepts/HerdGrouping/HerdGroupingConcept.test.ts:833:3
