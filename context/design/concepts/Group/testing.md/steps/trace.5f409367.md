---
timestamp: 'Fri Oct 17 2025 21:51:51 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_215151.7e39648f.md]]'
content_id: 5f409367a5f44f814cebe6d2a966af1e2ca3426c3b81c754c60697f446d59ab6
---

# trace: Herd Grouping Principle Fulfillment

This trace demonstrates the `HerdGrouping` concept fulfilling its principle:
"a user creates herds to group animals based on location, purpose, or management strategy, animals may be part of multiple herds; adds or removes animals from herds as conditions change; merges herds when combining groups, or splits them to separate animals; moves animals between herds to reflect real-world transitions; and views herd composition and history to support planning and analysis."

**Initial State:** No herds, no animals in the system.

**Scenario:** A farmer manages two main pastures (`NorthPasture`, `SouthPasture`) and a smaller `SickBay` for recovering animals. Over time, animals move between these areas, groups are adjusted, and eventually, the farmer decides to combine two groups and later reorganize another.

1. **Create initial herds:**
   * **Action:** `createHerd(name: "NorthPasture", description: "Main grazing area for dairy cows")`
   * **Action:** `createHerd(name: "SouthPasture", description: "Grazing area for young stock")`
   * **Action:** `createHerd(name: "SickBay", description: "Temporary area for sick or injured animals")`
   * **Expected State:** Three active herds: "NorthPasture", "SouthPasture", "SickBay", all empty.
   * **Verification:** `_listHerds()` shows three non-archived herds. `_viewComposition()` for each shows empty `animals` list.

2. **Add animals to herds:**
   * **Action:** `addAnimal(herdName: "NorthPasture", animal: "cow:Daisy")`
   * **Action:** `addAnimal(herdName: "NorthPasture", animal: "cow:Bella")`
   * **Action:** `addAnimal(herdName: "SouthPasture", animal: "calf:Sparky")`
   * **Action:** `addAnimal(herdName: "SouthPasture", animal: "calf:Barnaby")`
   * **Expected State:** "NorthPasture" has Daisy, Bella. "SouthPasture" has Sparky, Barnaby. "SickBay" is empty.
   * **Verification:** `_viewComposition("NorthPasture")` -> \[Daisy, Bella]. `_viewComposition("SouthPasture")` -> \[Sparky, Barnaby].

3. **An animal gets sick and moves to SickBay:**
   * **Action:** `moveAnimal(sourceHerdName: "NorthPasture", targetHerdName: "SickBay", animal: "cow:Bella")`
   * **Expected State:** "NorthPasture" has Daisy. "SouthPasture" has Sparky, Barnaby. "SickBay" has Bella.
   * **Verification:** `_viewComposition("NorthPasture")` -> \[Daisy]. `_viewComposition("SickBay")` -> \[Bella].

4. **Another animal is born and added directly to SouthPasture:**
   * **Action:** `addAnimal(herdName: "SouthPasture", animal: "calf:Rosie")`
   * **Expected State:** "SouthPasture" now has Sparky, Barnaby, Rosie.
   * **Verification:** `_viewComposition("SouthPasture")` -> \[Sparky, Barnaby, Rosie].

5. **A new "NightHerd" is created, and some animals from NorthPasture are moved there for the night:**
   * **Action:** `createHerd(name: "NightHerd", description: "Temporary herd for night bedding")`
   * **Action:** `splitHerd(sourceHerdName: "NorthPasture", targetHerdName: "NightHerd", animalsToMove: ["cow:Daisy"])`
   * **Expected State:** "NorthPasture" is empty. "NightHerd" has Daisy.
   * **Verification:** `_viewComposition("NorthPasture")` -> \[]. `_viewComposition("NightHerd")` -> \[Daisy].

6. **The farmer decides to merge NightHerd back into NorthPasture:**
   * **Action:** `mergeHerds(herdNameToKeep: "NorthPasture", herdNameToArchive: "NightHerd")`
   * **Expected State:** "NorthPasture" now has Daisy. "NightHerd" is archived and empty.
   * **Verification:** `_viewComposition("NorthPasture")` -> \[Daisy]. `_listHerds()` shows "NightHerd" as archived. `_viewComposition("NightHerd")` -> \[].

7. **Bella recovers and is returned to NorthPasture:**
   * **Action:** `moveAnimal(sourceHerdName: "SickBay", targetHerdName: "NorthPasture", animal: "cow:Bella")`
   * **Expected State:** "SickBay" is empty. "NorthPasture" has Daisy, Bella.
   * **Verification:** `_viewComposition("SickBay")` -> \[]. `_viewComposition("NorthPasture")` -> \[Daisy, Bella].

This trace covers `createHerd`, `addAnimal`, `removeAnimal` (implicitly by `moveAnimal` and `splitHerd`), `moveAnimal`, `splitHerd`, `mergeHerds`, and `_viewComposition` (implicitly throughout for verification) and `_listHerds`. It demonstrates dynamic grouping, changes to composition, and handling of temporary/archived groups, thus fulfilling the principle.
