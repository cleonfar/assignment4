# Test results

Check file:///C:/Users/cleon/assignment4/src/concepts/ReproductionTracking/ReproductionTrackingConcept.test.ts
Check file:///C:/Users/cleon/assignment4/src/concepts/ReproductionTracking/ReproductionTrackingConceptEdge.test.ts
running 13 tests from ./src/concepts/ReproductionTracking/ReproductionTrackingConcept.test.ts
ReproductionTrackingConcept - addMother action ...
  should successfully add a new mother and set notes to empty string ... ok (224ms)
  should return an error if mother with ID already exists ... ok (290ms)
ReproductionTrackingConcept - addMother action ... ok (2s)
ReproductionTrackingConcept - removeMother action ...
  should successfully remove an existing mother ... ok (380ms)
  should return an error if mother with ID does not exist ... ok (207ms)
ReproductionTrackingConcept - removeMother action ... ok (2s)
ReproductionTrackingConcept - recordLitter action ...
  should successfully record a litter and auto-add a new mother ... ok (617ms)
  should successfully record a litter with an existing mother and empty notes ... ok (575ms)
  should successfully record a litter without a father, using UNKNOWN_FATHER_ID and empty notes ... ok (424ms)
  should return an error for duplicate litter (mother, specific father, birthDate) ... ok (629ms)
  should return an error for duplicate litter (mother, UNKNOWN_FATHER_ID, birthDate) ... ok (625ms)
ReproductionTrackingConcept - recordLitter action ... ok (4s)
ReproductionTrackingConcept - updateLitter action ...
  should successfully update a single field (reportedLitterSize) ... ok (225ms)
  should successfully update multiple fields (birthDate, notes) ... ok (225ms)
  should successfully update fatherId from specific to new specific ... ok (215ms)
  should successfully update fatherId from specific to UNKNOWN_FATHER_ID (by passing undefined) ... ok (209ms)
  should successfully update fatherId from UNKNOWN_FATHER_ID to specific ... ok (208ms)
  should successfully update motherId to an existing mother ... ok (429ms)
  should successfully update motherId to a new mother (auto-creation) ... ok (1s)
  should successfully update notes to an empty string when undefined is passed ... ok (417ms)
  should not change notes if notes field is not provided in update arguments ... ok (418ms)
  should return an error if litterId does not exist ... ok (70ms)
ReproductionTrackingConcept - updateLitter action ... ok (5s)
ReproductionTrackingConcept - recordOffspring action ...
  should successfully record a new offspring with all details ... ok (294ms)
  should successfully record a new offspring without optional notes, storing as empty string ... ok (281ms)
  should return an error if litterId does not exist ... ok (137ms)
  should return an error if offspringId already exists ... ok (578ms)
ReproductionTrackingConcept - recordOffspring action ... ok (3s)
ReproductionTrackingConcept - updateOffspring action ...
  should successfully update a single field (sex) ... ok (212ms)
  should successfully update multiple fields (litterId, notes) ... ok (914ms)
  should successfully update notes to an empty string when undefined is passed ... ok (428ms)
  should not change notes if notes field is not provided in update arguments ... ok (460ms)
  should return an error if offspringId does not exist ... ok (68ms)
  should return an error if new litterId does not exist ... ok (207ms)
ReproductionTrackingConcept - updateOffspring action ... ok (4s)
ReproductionTrackingConcept - recordWeaning action ...
  should successfully record weaning for an alive offspring ... ok (706ms)
  should return an error if offspringId does not exist ... ok (77ms)
  should return an error if offspring is not alive ... ok (522ms)
ReproductionTrackingConcept - recordWeaning action ... ok (4s)
ReproductionTrackingConcept - recordDeath action ...
  should successfully record death for a living offspring that was not weaned ... ok (204ms)
  should return an error if offspringId does not exist ... ok (67ms)
  should return an error if offspring is already marked as deceased ... ok (481ms)
  should preserve survivedTillWeaning status if offspring dies after weaning was recorded ... ok (614ms)
ReproductionTrackingConcept - recordDeath action ... ok (6s)
ReproductionTrackingConcept - generateReport action ...
  should successfully generate a new report for a single target and date range ... ok (429ms)
  should successfully generate a new report with no relevant data ... ok (481ms)
  should add performance for a different target to an existing report ... ok (413ms)
  should not add duplicate performance entry for the same target and range to an existing report ... ok (505ms)
  should add a new performance entry for the same target but a different date range ... ok (489ms)
  should return an error if target mother does not exist ... ok (136ms)
ReproductionTrackingConcept - generateReport action ... ok (9s)
ReproductionTrackingConcept - renameReport action ...
  should successfully rename an existing report ... ok (406ms)
  should return an error if the old report name does not exist ... ok (67ms)
  should return an error if the new report name already exists ... ok (1s)
ReproductionTrackingConcept - renameReport action ... ok (3s)
ReproductionTrackingConcept - _viewReport query ...
  should successfully retrieve the results of an existing report ... ok (67ms)
  should return an error if the report name does not exist ... ok (67ms)
ReproductionTrackingConcept - _viewReport query ... ok (1s)
ReproductionTrackingConcept - deleteReport action ...
  should successfully delete an existing report ... ok (240ms)
  should return an error if the report name does not exist ... ok (69ms)
ReproductionTrackingConcept - deleteReport action ... ok (2s)
ReproductionTrackingConcept - AI Summary actions ...
  should generate a new AI summary when none exists for the report ... ok (3s)
  should return the cached AI summary without calling the AI again if one exists ... ok (210ms)
  should successfully regenerate AI summary, overwriting the old one ... ok (1s)
  should return an error if the report does not exist for AI summary ... ok (70ms)
  should return an error if the report does not exist for regenerate AI summary ... ok (73ms)
ReproductionTrackingConcept - AI Summary actions ... ok (25s)
running 1 test from ./src/concepts/ReproductionTracking/ReproductionTrackingConceptEdge.test.ts
ReproductionTrackingConcept - Edge Cases and Advanced Scenarios ...
  Scenario 1: Reporting for empty or incomplete data ...
    should report 0 litters/offspring for a mother with no recorded litters ... ok (291ms)
    should report 1 litter but 0 offspring for a litter with no recorded offspring ... ok (346ms)
    should correctly count actual offspring and calculate weaning survival for partially filled litter ... ok (346ms)
  Scenario 1: Reporting for empty or incomplete data ... ok (4s)
  Scenario 2: ReportedLitterSize vs. Actual Offspring Count in Reporting ...
    should use actual offspring count, not reportedLitterSize, in report generation ... ok (418ms)
    should still use actual offspring count even if reportedLitterSize is updated ... ok (553ms)
  Scenario 2: ReportedLitterSize vs. Actual Offspring Count in Reporting ... ok (2s)
  Scenario 3: Complex Weaning and Death Outcomes ...
    should correctly calculate weaning survival for mixed outcomes ... ok (624ms)
  Scenario 3: Complex Weaning and Death Outcomes ... ok (3s)
ReproductionTrackingConcept - Edge Cases and Advanced Scenarios ... ok (13s)

ok | 14 passed (63 steps) | 0 failed (1m29s)
