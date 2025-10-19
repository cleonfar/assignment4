# Test Results

Check file:///C:/Users/cleon/assignment4/src/concepts/GrowthTracking/GrowthTrackingConcept.test.ts
Check file:///C:/Users/cleon/assignment4/src/concepts/GrowthTracking/GrowthTrackingConceptEdge.test.ts
running 6 tests from ./src/concepts/GrowthTracking/GrowthTrackingConcept.test.ts
GrowthTrackingConcept - recordWeight action ...
  should successfully record a weight for a new animal ... ok (162ms)
  should successfully record another weight for an existing animal ... ok (141ms)
  should record a weight with empty notes if not provided ... ok (277ms)
  should allow recording multiple weights for the same animal on the same date ... ok (245ms)
  should return an error if animal ID is missing ... ok (0ms)
  should return an error if date is missing ... ok (0ms)
  should return an error if weight is missing ... ok (0ms)
  should return an error if date is invalid ... ok (0ms)
GrowthTrackingConcept - recordWeight action ... ok (2s)
GrowthTrackingConcept - removeWeightRecord action ...
  should successfully remove an existing weight record ... ok (285ms)
  should return an error if the weight record does not exist for an existing animal ... ok (344ms)
  should return an error if the animal does not exist ... ok (67ms)
  should return an error if animal ID is missing ... ok (0ms)
  should return an error if date is missing ... ok (1ms)
  should return an error if date is invalid ... ok (0ms)
GrowthTrackingConcept - removeWeightRecord action ... ok (2s)
GrowthTrackingConcept - generateReport action ...
  should create a new report for an animal with records in range ... ok (222ms)
  should update an existing report with a new animal ... ok (318ms)
  should update an existing report with updated data for an existing animal ... ok (277ms)
  should create a new report for an animal with no records in the specified range ... ok (204ms)
  should create a new report for an animal with only one record in range (ADG should be null) ... ok (279ms)
  should return an error if animal ID does not exist in the system at all ... ok (68ms)
  should return an error if animal ID is missing ... ok (0ms)
  should return an error if reportName is missing ... ok (0ms)
  should return an error if startDateRange is missing ... ok (1ms)
  should return an error if endDateRange is missing ... ok (0ms)
  should return an error if startDateRange is invalid ... ok (0ms)
  should return an error if endDateRange is invalid ... ok (0ms)
  should return an error if startDateRange is after endDateRange ... ok (0ms)
GrowthTrackingConcept - generateReport action ... ok (3s)
GrowthTrackingConcept - renameReport action ...
  should successfully rename an existing report ... ok (360ms)
  should return an error if old report name is missing ... ok (0ms)
  should return an error if new report name is missing ... ok (1ms)
  should return an error if the old report does not exist ... ok (70ms)
  should return an error if the new report name already exists ... ok (144ms)
  should return an error if old name and new name are the same ... ok (0ms)
GrowthTrackingConcept - renameReport action ... ok (2s)
GrowthTrackingConcept - deleteReport action ...
  should successfully delete an existing report ... ok (144ms)
  should return an error if report name is missing ... ok (1ms)
  should return an error if the report does not exist ... ok (70ms)
GrowthTrackingConcept - deleteReport action ... ok (1s)
GrowthTrackingConcept - AI Features (aiSummary action, _getAiSummary query) ...
  aiSummary action: should successfully generate and save an AI summary for an existing report ... ok (1s)
  aiSummary action: should return an error if report name is missing ... ok (0ms)
  aiSummary action: should return an error if the report does not exist ... ok (71ms)
  _getAiSummary query: should return an existing summary without re-generating ... ok (286ms)
  _getAiSummary query: should generate and save a new summary if none exists ... ok (1s)
  _getAiSummary query: should return an error if report name is missing ... ok (0ms)
  _getAiSummary query: should return an error if the report does not exist ... ok (83ms)
GrowthTrackingConcept - AI Features (aiSummary action, _getAiSummary query) ... ok (6s)
running 1 test from ./src/concepts/GrowthTracking/GrowthTrackingConceptEdge.test.ts
GrowthTrackingConcept - Edge Cases and AI Classification ...
  Scenario 1: Handling duplicate weight records on the same date and their removal ... ok (524ms)
  Scenario 2: AI should classify an animal with strong, consistent growth as a 'high performer' ... ok (1s)
  Scenario 3: AI should classify an animal with significant weight loss as 'low performer' or 'concerning trend' ... ok (1s)
  Scenario 4: AI should flag an animal with an improbable weight record as 'potential record error' ... ok (1s)
  Scenario 5: AI should flag an animal with insufficient data (single record) as 'insufficientData' ... ok (1s)
GrowthTrackingConcept - Edge Cases and AI Classification ... ok (8s)

ok | 7 passed (48 steps) | 0 failed (27s)
