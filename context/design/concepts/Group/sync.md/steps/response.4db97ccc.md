---
timestamp: 'Sun Nov 02 2025 16:03:24 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_160324.74adff65.md]]'
content_id: 4db97ccceea7078318fda86ce0137dfb5e11eb5ff5a167756e293c919442eefb
---

# response:

The key to resolving this lies in understanding the distinction between how a `Set` is described in the abstract concept specification and how it must be represented when passed as an argument in a JSON-based API call (which is what concept actions effectively are).

While the concept specification can use `Set<Animal>` to convey the mathematical idea of a collection of unique items, when it comes to the concrete implementation and API input, a `Set` is a JavaScript object type that is not directly serializable as a primitive JSON value.

The rule "actions can only take primitives as input" (more precisely, "a dictionary/JSON object with primitive values (no custom objects)") means that the *fields* of your input dictionary should be JSON primitive types (strings, numbers, booleans, null) or arrays of these primitive types. An array of `ID`s (which are branded strings) fits this criteria perfectly, as it's directly representable as a JSON array of strings.

Therefore, the solution is to adjust the action signature for `splitHerd` to accept an `Array<Animal>` instead of a `Set<Animal>`.

### Proposed Change to `splitHerd` Action:

```concept
concept HerdGrouping
...
actions
  // Original:
  // splitHerd (source: String, target: String, animals: Set<Animal>): Empty

  // Revised:
  splitHerd (source: String, target: String, animals: Array<Animal>): Empty
    // requires source herd exists and all animals are members of source
    // effects move specified animals from source to target and record a split event
```

### Explanation:

1. **JSON Compatibility:** An `Array<Animal>` (which resolves to `Array<ID>` or `string[]` in TypeScript, as `ID` is a branded `string`) is a standard, primitive-containing JSON structure. You can easily send `["animalId1", "animalId2"]` as part of your action's input dictionary.
2. **Meaning Preservation:** Conceptually, `Array<Animal>` can still represent the same idea as a `Set<Animal>` for this purpose. Within the action's implementation, you can choose to treat the input array as a set (e.g., by converting it to a `Set` object internally to ensure uniqueness if that's a strict requirement for your operation). However, for the *input payload*, an array is the appropriate choice.
3. **Adherence to Guidelines:** This change adheres to the guideline that action arguments should be dictionary objects with primitive values or arrays of primitive values, without using custom object instances directly as arguments.

This adjustment allows you to pass a list of animal IDs to the `splitHerd` action while maintaining compatibility with the concept design principles for action inputs.
