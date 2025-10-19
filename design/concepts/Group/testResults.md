# Test Results

HerdGroupingConcept ...
  createHerd: should create a new herd successfully ...
------- output -------

--- Test: createHerd: should create a new herd successfully ---
HERD_A after creation: []
----- output end -----
  createHerd: should create a new herd successfully ... ok (292ms)
  createHerd: should return error for duplicate herd name ...
------- output -------

--- Test: createHerd: should return error for duplicate herd name ---
----- output end -----
  createHerd: should return error for duplicate herd name ... ok (67ms)
  createHerd: should return error for empty herd name ...
------- output -------

--- Test: createHerd: should return error for empty herd name ---
----- output end -----
  createHerd: should return error for empty herd name ... ok (0ms)
  createHerd: should create another herd ...
------- output -------

--- Test: createHerd: should create another herd ---
HERD_B after creation: []
----- output end -----
  createHerd: should create another herd ... ok (203ms)
  addAnimal: should add an animal to a herd ...
------- output -------

--- Test: addAnimal: should add an animal to a herd ---
HERD_A after adding ANIMAL_1: ["animal:001"]
----- output end -----
  addAnimal: should add an animal to a herd ... ok (205ms)
  addAnimal: should add another animal to the same herd ...
------- output -------

--- Test: addAnimal: should add another animal to the same herd ---
HERD_A after adding ANIMAL_2: ["animal:001","animal:002"]
----- output end -----
  addAnimal: should add another animal to the same herd ... ok (204ms)
  addAnimal: should return error if animal is already a member ...
------- output -------

--- Test: addAnimal: should return error if animal is already a member ---
----- output end -----
  addAnimal: should return error if animal is already a member ... ok (67ms)
  addAnimal: should return error for non-existent herd ...
------- output -------

--- Test: addAnimal: should return error for non-existent herd ---
----- output end -----
  addAnimal: should return error for non-existent herd ... ok (66ms)
  removeAnimal: should remove an animal from a herd ...
------- output -------

--- Test: removeAnimal: should remove an animal from a herd ---
HERD_A after removing ANIMAL_1: ["animal:002"]
----- output end -----
  removeAnimal: should remove an animal from a herd ... ok (203ms)
  removeAnimal: should return error if animal is not a member ...
------- output -------

--- Test: removeAnimal: should return error if animal is not a member ---
----- output end -----
  removeAnimal: should return error if animal is not a member ... ok (68ms)
  removeAnimal: should return error for non-existent herd ...
------- output -------

--- Test: removeAnimal: should return error for non-existent herd ---
----- output end -----
  removeAnimal: should return error for non-existent herd ... ok (66ms)
  moveAnimal: should move an animal between herds ...
------- output -------

--- Test: moveAnimal: should move an animal between herds ---
HERD_A before move: ["animal:002","animal:003"]
HERD_B before move: []
HERD_A after move: ["animal:002"]
HERD_B after move: ["animal:003"]
----- output end -----
  moveAnimal: should move an animal between herds ... ok (744ms)
  moveAnimal: should return error if animal not in source herd ...
------- output -------

--- Test: moveAnimal: should return error if animal not in source herd ---
----- output end -----
  moveAnimal: should return error if animal not in source herd ... ok (132ms)
  moveAnimal: should *not* return error if animal already in target herd, and ensure it's still there ...
------- output -------

--- Test: moveAnimal: should *not* return error if animal already in target herd ---
HERD_A before move: ["animal:002","animal:003"]
HERD_B before move (ANIMAL_3 already there): ["animal:003"]
HERD_A after move: ["animal:002"]
HERD_B after move: ["animal:003"]
----- output end -----
  moveAnimal: should *not* return error if animal already in target herd, and ensure it's still there ... ok (738ms)
  moveAnimal: should return error if source and target are the same ...
------- output -------

--- Test: moveAnimal: should return error if source and target are the same ---
----- output end -----
  moveAnimal: should return error if source and target are the same ... ok (0ms)
  splitHerd: should split animals from one herd to another ...
------- output -------

--- Test: splitHerd: should split animals from one herd to another ---
HERD_A before split: ["animal:002","animal:004","animal:005","animal:006"]
HERD_C before split: []
HERD_A after split: ["animal:002","animal:006"]
HERD_C after split: ["animal:004","animal:005"]
----- output end -----
  splitHerd: should split animals from one herd to another ... ok (1s)
  splitHerd: should return error if any animal not in source ...
------- output -------

--- Test: splitHerd: should return error if any animal not in source ---
HERD_A before split attempt: ["animal:002","animal:006"]
HERD_C before split attempt: ["animal:004","animal:005"]
Split attempt resulted in error: Animals animal:001, animal:004 are not members of the source herd 'Pasture A'.
HERD_A after failed split: ["animal:002","animal:006"]
HERD_C after failed split: ["animal:004","animal:005"]
----- output end -----
  splitHerd: should return error if any animal not in source ... ok (333ms)
  splitHerd: should *not* return error if some animals already in target (lenient target) ...
------- output -------

--- Test: splitHerd: should *not* return error if some animals already in target ---
HERD_A before split (source): ["animal:002","animal:006","animal:007"]
HERD_C before split (target): ["animal:004","animal:005","animal:006"]
HERD_A after split: ["animal:002"]
HERD_C after split: ["animal:004","animal:005","animal:006","animal:007"]
----- output end -----
  splitHerd: should *not* return error if some animals already in target (lenient target) ... ok (909ms)
  splitHerd: should return error for empty animals to move ...
------- output -------

--- Test: splitHerd: should return error for empty animals to move ---
----- output end -----
  splitHerd: should return error for empty animals to move ... ok (0ms)
  mergeHerds: should merge animals from one herd into another and archive the source ...
------- output -------

--- Test: mergeHerds: should merge animals from one herd into another and archive the source ---
HERD_D before merge: ["animal:001","animal:002"]
HERD_A before merge: ["animal:002"]
HERD_A after merge: ["animal:002","animal:001"]
HERD_D after merge: []
----- output end -----
  mergeHerds: should merge animals from one herd into another and archive the source ... ok (1s)
  mergeHerds: should return error if merging herd into itself ...
------- output -------

--- Test: mergeHerds: should return error if merging herd into itself ---
----- output end -----
  mergeHerds: should return error if merging herd into itself ... ok (0ms)
  mergeHerds: should prevent modifying archived herds ...
------- output -------

--- Test: mergeHerds: should prevent modifying archived herds ---
----- output end -----
  mergeHerds: should prevent modifying archived herds ... ok (69ms)
  _viewComposition: should return error for non-existent herd ...
------- output -------

--- Test: _viewComposition: should return error for non-existent herd ---
----- output end -----
  _viewComposition: should return error for non-existent herd ... ok (69ms)
  _listHerds: should return all current herds (including archived) ...
------- output -------

--- Test: _listHerds: should return all current herds (including archived) ---
Listed Herd A: {"name":"Pasture A","description":"Main pasture for cows","isArchived":false}
Listed Herd B: {"name":"Barn B","description":"Night barn","isArchived":false}
Listed Herd C: {"name":"Quarantine C","description":"Quarantine pen","isArchived":false}
Listed Herd D: {"name":"Calf Pen D","description":"Calf pen","isArchived":true}
----- output end -----
  _listHerds: should return all current herds (including archived) ... ok (67ms)
HerdGroupingConcept ... ok (8s)
running 1 test from ./src/concepts/HerdGrouping/HerdGroupingConceptEdge.test.ts
HerdGroupingConcept - Edge Cases ...
  createHerd for initial setup for edge cases ... ok (2s)
  splitHerd: should create new target herd if it does not exist ...
------- post-test output -------

--- Test: splitHerd creates new target herd ---
HERD_E before split: ["animal:alpha","animal:beta","animal:gamma"]
New Herd 'New Target Herd' after split: ["animal:alpha","animal:beta"]
HERD_E after split: ["animal:gamma"]
----- post-test output end -----
  splitHerd: should create new target herd if it does not exist ... ok (746ms)
  moveAnimal: should return error if source herd is archived ...
------- post-test output -------

--- Test: moveAnimal from archived source ---
Move attempt from archived HERD_G resulted in error: Source herd 'Herd Gamma' is archived.
----- post-test output end -----
  moveAnimal: should return error if source herd is archived ... ok (886ms)
  removeAnimal: should leave herd empty after removing last animal ...
------- post-test output -------

--- Test: removeAnimal last animal ---
HERD_F before removing last animal: ["animal:epsilon"]
HERD_F after removing last animal: []
----- post-test output end -----
  removeAnimal: should leave herd empty after removing last animal ... ok (408ms)
  splitHerd: should move all animals from source herd, leaving it empty ...
------- post-test output -------

--- Test: splitHerd moving all animals ---
HERD_H before split: ["animal:phi","animal:sigma"]
HERD_F before split: []
HERD_H after split: []
HERD_F after split: ["animal:phi","animal:sigma"]
----- post-test output end -----
  splitHerd: should move all animals from source herd, leaving it empty ... ok (691ms)
  mergeHerds: handles duplicates and preserves existing target members correctly ...
------- post-test output -------

--- Test: mergeHerds complex duplicates ---
HERD_I (to keep) before merge: ["animal:delta","animal:epsilon"]
HERD_J (to archive) before merge: ["animal:epsilon","animal:alpha"]
HERD_I after merge: ["animal:delta","animal:epsilon","animal:alpha"]
HERD_J after merge: []
----- post-test output end -----
  mergeHerds: handles duplicates and preserves existing target members correctly ... ok (674ms)
HerdGroupingConcept - Edge Cases ... ok (6s)

ok | 2 passed (30 steps) | 0 failed (15s)
