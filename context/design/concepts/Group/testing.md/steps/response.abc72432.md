---
timestamp: 'Fri Oct 17 2025 22:12:48 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_221248.d6261c4e.md]]'
content_id: abc72432b0000b8ac4e29d32c859f501392e9c002922e04ae1a8af1d68b7eed1
---

# response:

Yes, the `moveAnimal` action already returns an error if the animal to be moved is already a member of the target herd.

Looking at the code you provided:

```typescript
  async moveAnimal(
    { sourceHerdName, targetHerdName, animal }: {
      sourceHerdName: string;
      targetHerdName: string;
      animal: Animal;
    },
  ): Promise<Empty | { error: string }> {
    // ... (other checks)

    // Check if animal is already in the targetHerd (precondition check)
    if (targetHerd.members.includes(animal)) {
      return { error: `Animal '${animal}' is already a member of target herd '${targetHerdName}'.` };
    }

    // ... (transaction logic to remove from source and add to target)
  }
```

This `if` statement directly implements the precondition from the concept specification: "`animal` is *not* a member of `targetHerd`." If this condition is violated, an error object is returned, preventing the move.

Furthermore, your provided test file already includes a test case specifically for this scenario, demonstrating its correct behavior:

```typescript
  await t.step("moveAnimal: should return error if animal already in target herd", async () => {
    // ... setup to ensure ANIMAL_3 is in HERD_B
    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_B,
      animal: ANIMAL_3, // ANIMAL_3 is already in HERD_B from a previous test step
    });
    assertEquals("error" in result, true);
    if (!("error" in result)) { // Type narrowing
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Animal '${ANIMAL_3}' is already a member of target herd '${HERD_B}'.`);
  });
```

So, to answer your question directly:

1. **Are we returning an error in `moveAnimal` if the animal to be moved is already in the `targetHerd`?**
   Yes, we are.
2. **If not, can we?**
   Since we are, this is moot, but if we weren't, it would be a critical precondition to add to ensure the action's integrity and provide clear feedback.

The implementation and tests are correct on this point!
