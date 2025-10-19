---
timestamp: 'Fri Oct 17 2025 22:58:58 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_225858.76279072.md]]'
content_id: 621b15e5857e48a2ad61b2a1cb5de164cdd3a8190d76a127043b6a44da4bbe81
---

# response:

You're encountering a failure in the test case `splitHerd: should return error if any animal not in source` because the actual error message received from the `splitHerd` action includes more animals than the test expects.

Let's trace the state of `HERD_A` leading up to this specific test:

1. **After "splitHerd: should split animals from one herd to another" test:**

   * `HERD_A` has `[ANIMAL_2, ANIMAL_6]`
   * `HERD_C` has `[ANIMAL_4, ANIMAL_5]`
   * `ANIMAL_3` is still in `HERD_B` (from the "moveAnimal" tests).
   * `ANIMAL_1` is still in `HERD_D` (from the "mergeHerds" test, which runs *after* this failing test conceptually, but `testDb` clears db before *each file*, not each test, so the order matters here). Ah, wait. The `mergeHerds` test hasn't run yet if we are failing at this `splitHerd` test. Let's assume the tests run in sequential order as defined in the file.

   Let's re-trace carefully from the beginning to the point of failure:

   * `createHerd("Pasture A")` -> `HERD_A` = `[]`
   * `createHerd("Barn B")` -> `HERD_B` = `[]`
   * `addAnimal("Pasture A", ANIMAL_1)` -> `HERD_A` = `[ANIMAL_1]`
   * `addAnimal("Pasture A", ANIMAL_2)` -> `HERD_A` = `[ANIMAL_1, ANIMAL_2]`
   * `removeAnimal("Pasture A", ANIMAL_1)` -> `HERD_A` = `[ANIMAL_2]`
   * `addAnimal("Pasture A", ANIMAL_3)` (in `moveAnimal` setup) -> `HERD_A` = `[ANIMAL_2, ANIMAL_3]`
   * `moveAnimal("Pasture A", "Barn B", ANIMAL_3)` -> `HERD_A` = `[ANIMAL_2]`, `HERD_B` = `[ANIMAL_3]`
   * `addAnimal("Pasture A", ANIMAL_3)` (in `moveAnimal` "not return error if already in target" setup) -> `HERD_A` = `[ANIMAL_2, ANIMAL_3]`
   * `moveAnimal("Pasture A", "Barn B", ANIMAL_3)` -> `HERD_A` = `[ANIMAL_2]`, `HERD_B` = `[ANIMAL_3]`
   * `createHerd("Quarantine C")` (in `splitHerd` setup) -> `HERD_C` = `[]`
   * `addAnimal("Pasture A", ANIMAL_4)` -> `HERD_A` = `[ANIMAL_2, ANIMAL_4]`
   * `addAnimal("Pasture A", ANIMAL_5)` -> `HERD_A` = `[ANIMAL_2, ANIMAL_4, ANIMAL_5]`
   * `addAnimal("Pasture A", ANIMAL_6)` -> `HERD_A` = `[ANIMAL_2, ANIMAL_4, ANIMAL_5, ANIMAL_6]`
   * `splitHerd("Pasture A", "Quarantine C", [ANIMAL_4, ANIMAL_5])` -> `HERD_A` = `[ANIMAL_2, ANIMAL_6]`, `HERD_C` = `[ANIMAL_4, ANIMAL_5]`

Now we are at the beginning of the failing test: **`splitHerd: should return error if any animal not in source`**

* **Current state of `HERD_A`**: `[ANIMAL_2, ANIMAL_6]`
* **`animalsToSplit` for this test**: `[ANIMAL_1, ANIMAL_4]`

Let's check which animals from `animalsToSplit` are *not* in `HERD_A`:

1. `ANIMAL_1`: Is not in `HERD_A`. (Expected to be missing)
2. `ANIMAL_4`: Is not in `HERD_A`. (`ANIMAL_4` was moved to `HERD_C` in the previous test step).

Therefore, the action correctly identifies that both `ANIMAL_1` and `ANIMAL_4` are missing from `HERD_A`. The error message `Animals animal:001, animal:004 are not members of the source herd 'Pasture A'.` is the correct behavior based on the current state.

The test, however, expects only `ANIMAL_1` to be missing.

**The fix is to update the `assertEquals` call in this test step to reflect that both `ANIMAL_1` and `ANIMAL_4` should be in the error message.**

Here's the corrected test:
