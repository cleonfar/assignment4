---
timestamp: 'Fri Oct 17 2025 22:36:39 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_223639.aadd9ea8.md]]'
content_id: 3990a62d44d73732f9e820160cb5a484d865a7dea2dd2d4a5d0bf2eda3fe152d
---

# Prompt: We're currently failing a few test cases. The first is this one, any guesses why?

HerdGroupingConcept ... splitHerd: should split animals from one herd to another => ./src/concepts/HerdGrouping/HerdGroupingConcept.test.ts:365:11
error: AssertionError: Expected actual: "\[
"animal:002",
"animal:004",
"animal:005",
"animal:006",
]" to include: "\[
"animal:002",
"animal:003",
"animal:004",
"animal:005",
"animal:006",
]".
missing: \[
"animal:003",
]
