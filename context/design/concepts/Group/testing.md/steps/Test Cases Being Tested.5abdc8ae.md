---
timestamp: 'Sat Oct 18 2025 12:25:40 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_122540.2eb5eac2.md]]'
content_id: 5abdc8aec1240995ee2664354c419ffaccce69d45b413213a280ae5e0f26f958
---

# Test Cases Being Tested:

1. **`splitHerd` Creates Non-Existent Target Herd:**
   * **Description:** This test verifies the recently implemented functionality where the `splitHerd` action automatically creates a new herd if the specified `targetHerdName` does not already exist. It ensures that the new herd is created correctly, and animals are moved as expected.
2. **Attempting `moveAnimal` From an Archived Source Herd:**
   * **Description:** This scenario explicitly checks the robustness of the `moveAnimal` action against archived herds. It confirms that an error is returned if a user tries to move an animal *from* a herd that has been marked as archived, reinforcing the immutability of archived herds.
3. **Removing the Last Animal from a Herd:**
   * **Description:** This edge case tests `removeAnimal` to ensure that when the last remaining animal is removed from a herd, the herd's `members` list correctly becomes empty, and no unexpected state remains.
4. **`splitHerd` Moving All Animals from Source Herd:**
   * **Description:** This tests a boundary condition for the `splitHerd` action, verifying that if all animals from the `sourceHerd` are specified to be moved, the `sourceHerd` correctly becomes empty, and all animals are successfully transferred to the `targetHerd`.
5. **`mergeHerds` with Complex Duplicate Handling and Existing Target Members:**
   * **Description:** This is a more comprehensive test for `mergeHerds`. It sets up a scenario where the `herdToKeep` already has some animals, and the `herdToArchive` has both unique animals and animals that are duplicates of those already in `herdToKeep`. It verifies that `herdToKeep` ends up with all unique animals from both original herds (without duplicates), and `herdToArchive` is correctly archived and cleared.

***
