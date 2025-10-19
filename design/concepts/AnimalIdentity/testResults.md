# Test Results

AnimalIdentityConcept actions ...
  registerAnimal: should successfully register an animal with all fields provided ... ok (1s)
  registerAnimal: should successfully register an animal with only required fields ... ok (1s)
  registerAnimal: should return an error when registering an animal with an existing ID ... ok (1s)
  registerAnimal: should register multiple animals successfully ... ok (1s)
  updateStatus: should successfully update an animal's status and notes ... ok (1s)
  updateStatus: should return an error if animal to update does not exist ... ok (1s)
  editDetails: should successfully update an animal's identifying attributes ... ok (1s)
  editDetails: should return an error if animal to edit does not exist ... ok (1s)
  markAsTransferred: should successfully mark an alive animal as transferred ... ok (1s)
  markAsTransferred: should return an error if animal to transfer does not exist ... ok (1s)
  markAsTransferred: should return an error if animal is not alive ... ok (1s)
  markAsDeceased: should successfully mark an alive animal as deceased ... ok (1s)
  markAsDeceased: should return an error if animal to mark deceased does not exist ... ok (1s)
  markAsDeceased: should return an error if animal is not alive ... ok (1s)
  markAsSold: should successfully mark an alive animal as sold ... ok (1s)
  markAsSold: should return an error if animal to mark sold does not exist ... ok (1s)
  markAsSold: should return an error if animal is not alive ... ok (1s)
AnimalIdentityConcept actions ... ok (27s)
running 1 test from ./src/concepts/AnimalIdentity/AnimalIdentityConceptEdge.test.ts
AnimalIdentityConcept: Edge Cases and Scenarios ...
  Scenario 1: Should allow editing details of an animal that is no longer 'alive' ... ok (2s)
  Scenario 2: Should prevent 'markAsX' actions on animals not in 'alive' status ... ok (1s)
  Scenario 3: Should allow populating all optional fields using editDetails after minimal registration ... ok (1s)
AnimalIdentityConcept: Edge Cases and Scenarios ... ok (5s)

ok | 2 passed (20 steps) | 0 failed (33s)
