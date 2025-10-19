---
timestamp: 'Mon Oct 13 2025 15:24:34 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_152434.98c9f05a.md]]'
content_id: 84c67503c58140292da48e35ba6a7f252ba6d6835216dc81f6d3ccb73241dedd
---

# prompt: I have these two concepts, along with a few others that aren't important at the moment, that together will make up a livestock management app. I am trying to make the best decisions regarding modularity and good concept design. I am worried that with these as separate concepts, there are modularity issues with the DataAnalysis concept relying on records produced by the record concept. On the other hand I'm worried that combining the two concepts into 1 would create an excessively large concept that handles multiple concerns rather than the desired one concept per concern. I wanted your input on ways to approach this. Bear in mind that concepts cannot directly interact with each other. Also, remember that input to and output from actions must be either primitive values (strings, numbers, etc) or object identifiers (actually document identifiers in MongoDB).
