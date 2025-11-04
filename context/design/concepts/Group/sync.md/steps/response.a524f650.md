---
timestamp: 'Sun Nov 02 2025 16:03:24 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_160324.74adff65.md]]'
content_id: a524f65048ba3a3ae4759db36ed35f32e4bf66cffcd730b355184970cb1755d6
---

# response:

Based on the concept specification and its implementation:

The `splitHerd` action **does not create a new herd**. It requires that both the `sourceHerd` and the `targetHerd` already exist.

If the `targetHerdName` provided to `splitHerd` does not correspond to an existing herd, the action will return an error: `Target herd '{targetHerdName}' not found.`.

Instead, `splitHerd` takes a list of animals from the `sourceHerd` and **adds them to the existing `targetHerd`**. The use of MongoDB's `$addToSet` operator in the implementation ensures that if any of the animals are already present in the `targetHerd`, they will not be added again (preventing duplicates within the target herd's `members` list).
