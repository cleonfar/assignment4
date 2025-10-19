---
timestamp: 'Thu Oct 16 2025 15:44:15 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_154415.649a32c7.md]]'
content_id: 0c4d23685e3d07e59b03b548b8c012f3004350d86e4be726d0caeba4f7af6749
---

# response:

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.test.ts
import { Collection, Db, MongoClient } from "npm:mongodb";
import { assertEquals, assertExists, assertInstanceOf, assertObjectMatch } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import ReproductionTrackingConcept, { Sex } from "./ReproductionTrackingConcept.ts";

// Define the dynamic mock logic for GoogleGenerativeAI
const dynamicMockGenerateContent = async (_prompt: string) => {
  // 1. Extract report.results JSON string from the prompt
  // The regex now more robustly captures the JSON block, accounting for potential leading/trailing whitespace.
  const reportDataRegex = /Here is the reproduction report data in JSON format:\s*\n?([\s\S]*?)\n?\s*JSON Summary:/;
  const match = _prompt.match(reportDataRegex);

  if (!match || !match[1]) {
    console.error("Could not extract report data from prompt:", _prompt);
    return {
      response: {
        text: () => JSON.stringify({ error: "Could not parse report from prompt" }),
      },
    };
  }

  const extractedReportJson = match[1].trim(); // Trim to remove potential extra newlines/spaces
  let reportResults: Awaited<ReturnType<ReproductionTrackingConcept['generateReport']>>['report']['results'];
  try {
    reportResults = JSON.parse(extractedReportJson);
  } catch (e: unknown) { // Explicitly type e as unknown
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("Failed to parse extracted report JSON:", extractedReportJson, e);
    return {
      response: {
        text: () => JSON.stringify({ error: `Failed to parse report JSON: ${errorMessage}` }),
      },
    };
  }

  const highPerformers: string[] = [];
  const lowPerformers: string[] = [];
  const concerningTrends: string[] = [];
  const averagePerformers: string[] = [];
  const potentialRecordErrors: string[] = [];

  const parseRate = (rateString: string) => parseFloat(rateString.replace('%', ''));

  // Collect all mother IDs to ensure every mother is classified
  const allMotherIdsInReport = new Set<string>();
  reportResults.perMotherPerformance.forEach(m => allMotherIdsInReport.add(m.motherId));
  const classifiedMotherIds = new Set<string>();

  for (const mother of reportResults.perMotherPerformance) {
    let isError = false;

    // --- Potential Record Error Checks ---
    // Rule 1: totalOffspringWeaned > totalOffspringBorn
    if (mother.totalOffspringWeaned > mother.totalOffspringBorn) {
      potentialRecordErrors.push(mother.motherId);
      isError = true;
    }

    // Rule 2: Extremely low average actual offspring per litter (e.g., < 0.2 means less than 1 offspring per 5 litters)
    if (!isError && mother.littersRecorded > 0 && mother.totalOffspringBorn > 0 && mother.averageActualOffspringPerLitter < 0.2) {
      potentialRecordErrors.push(mother.motherId);
      isError = true;
    }

    // Rule 3: Impossibly high average actual offspring per litter (e.g., > 15 for typical livestock)
    if (!isError && mother.averageActualOffspringPerLitter > 15) {
      potentialRecordErrors.push(mother.motherId);
      isError = true;
    }

    if (isError) {
      classifiedMotherIds.add(mother.motherId);
    }

    // --- Performance Classification (only if no error detected) ---
    if (!isError) {
      const weaningRate = parseRate(mother.weaningSurvivabilityRate);
      const avgOffspring = mother.averageActualOffspringPerLitter;

      // Thresholds for classification
      const HIGH_PERF_RATE_THRESHOLD = 85; // %
      const LOW_PERF_RATE_THRESHOLD = 40;  // %
      const AVG_OFFSPRING_HIGH_THRESHOLD = 4; // Example: more than 4 offspring/litter is good
      const AVG_OFFSPRING_LOW_THRESHOLD = 1.5; // Example: less than 1.5 offspring/litter is low
      const CONCERNING_DEATH_RATIO = 0.5; // E.g., >50% of born offspring died

      if (weaningRate >= HIGH_PERF_RATE_THRESHOLD && avgOffspring >= AVG_OFFSPRING_HIGH_THRESHOLD) {
        highPerformers.push(mother.motherId);
      } else if (weaningRate < LOW_PERF_RATE_THRESHOLD || avgOffspring < AVG_OFFSPRING_LOW_THRESHOLD) {
        lowPerformers.push(mother.motherId);
      } else if (mother.totalOffspringBorn > 0 && (mother.totalDeceasedOffspring / mother.totalOffspringBorn) >= CONCERNING_DEATH_RATIO) {
        concerningTrends.push(mother.motherId);
      } else {
        averagePerformers.push(mother.motherId);
      }
      classifiedMotherIds.add(mother.motherId);
    }
  }

  // Ensure all mothers are classified into *some* category, putting remaining unclassified into average
  allMotherIdsInReport.forEach(motherId => {
      if (!classifiedMotherIds.has(motherId)) {
          averagePerformers.push(motherId);
      }
  });

  // Generate insights (simplified for mock, but covering key points)
  let insights = "This is a summarized analysis of reproductive performance based on the provided report. ";
  if (highPerformers.length > 0) insights += `High performers identified: ${highPerformers.join(', ')}. These mothers consistently show excellent survivability and good litter sizes. `;
  if (lowPerformers.length > 0) insights += `Low performers: ${lowPerformers.join(', ')}. These mothers exhibit poor outcomes in terms of weaning rates or average litter size, requiring further investigation into health or environmental factors. `;
  if (concerningTrends.length > 0) insights += `Mothers with concerning trends: ${concerningTrends.join(', ')}. High mortality rates, despite potentially moderate weaning, highlight a need for detailed analysis into causes of death. `;
  if (potentialRecordErrors.length > 0) insights += `Potential record errors detected for: ${potentialRecordErrors.join(', ')}. These records show inconsistencies or improbable values (e.g., more weaned than born, or extreme average litter sizes) that urgently need verification to ensure data accuracy. `;
  if (averagePerformers.length > 0) insights += `Average performers: ${averagePerformers.join(', ')}. Their performance aligns with the overall group's average and does not indicate immediate concerns or exceptional strengths. `;
  insights += "Effective breeding decisions will leverage these insights, focusing on improving outcomes for low performers and verifying any flagged data.";

  return {
    response: {
      text: () =>
        JSON.stringify({
          highPerformers,
          lowPerformers,
          concerningTrends,
          averagePerformers,
          potentialRecordErrors,
          insights,
        }, null, 2), // Pretty print for easier debugging
    },
  };
};

// Override the module's export for testing purposes
class MockGoogleGenerativeAI {
  constructor(_apiKey: string) {}
  getGenerativeModel(_options: unknown) {
    return {
      generateContent: dynamicMockGenerateContent, // Use the dynamic mock
    };
  }
}

// @ts-ignore: We are intentionally overriding the import for testing
import * as GoogleGenerativeAIModule from "npm:@google/generative-ai";
GoogleGenerativeAIModule.GoogleGenerativeAI = MockGoogleGenerativeAI;


Deno.test("ReproductionTrackingConcept", async (t) => {
  let db: Db;
  let client: MongoClient;
  let concept: ReproductionTrackingConcept;

  Deno.test.beforeEach(async () => {
    [db, client] = await testDb();
    concept = new ReproductionTrackingConcept(db);
  });

  Deno.test.afterEach(async () => {
    await client.close();
  });

  await t.step("addMother action", async (t) => { /* ... existing test ... */ });
  await t.step("removeMother action", async (t) => { /* ... existing test ... */ });
  await t.step("recordLitter action", async (t) => { /* ... existing test ... */ });
  await t.step("updateLitter action", async (t) => { /* ... existing test ... */ });
  await t.step("recordOffspring action", async (t) => { /* ... existing test ... */ });
  await t.step("updateOffspring action", async (t) => { /* ... existing test ... */ });
  await t.step("recordWeaning action", async (t) => { /* ... existing test ... */ });
  await t.step("recordDeath action", async (t) => { /* ... existing test ... */ });
  await t.step("viewLittersOfMother action", async (t) => { /* ... existing test ... */ });
  await t.step("viewOffspringOfLitter action", async (t) => { /* ... existing test ... */ });
  await t.step("generateReport action", async (t) => { /* ... existing test ... */ });
  await t.step("renameReport action", async (t) => { /* ... existing test ... */ });
  await t.step("viewReport action", async (t) => { /* ... existing test ... */ });
  await t.step("listReports action", async (t) => { /* ... existing test ... */ });
  await t.step("deleteReport action", async (t) => { /* ... existing test ... */ });

  await t.step("aiSummary actions", async (t) => {
    Deno.env.set("GEMINI_API_KEY", "MOCK_API_KEY"); // Ensure API key is set for all AI tests

    await t.step("should correctly classify different types of performers", async () => {
      const motherHigh = "M_HIGH";
      const motherLow = "M_LOW";
      const motherConcern = "M_CONCERN";
      const motherAverage = "M_AVG";

      await concept.addMother({ motherId: motherHigh });
      await concept.addMother({ motherId: motherLow });
      await concept.addMother({ motherId: motherConcern });
      await concept.addMother({ motherId: motherAverage });

      // M_HIGH: High performance (10 born, 9 weaned, 1 died)
      const { litter: lH } = await concept.recordLitter({ motherId: motherHigh, birthDate: new Date("2023-01-01"), reportedLitterSize: 10 });
      for (let i = 0; i < 10; i++) {
        const { offspring } = await concept.recordOffspring({ litterId: lH!._id, offspringId: `${motherHigh}_o${i}`, sex: Sex.Female });
        if (i < 9) await concept.recordWeaning({ offspringId: offspring!._id });
        else await concept.recordDeath({ offspringId: offspring!._id });
      } // 1 litter, 10 born, 9 weaned (90% rate), avg: 10

      // M_LOW: Low performance (5 born, 1 weaned, 4 died)
      const { litter: lL } = await concept.recordLitter({ motherId: motherLow, birthDate: new Date("2023-01-02"), reportedLitterSize: 5 });
      for (let i = 0; i < 5; i++) {
        const { offspring } = await concept.recordOffspring({ litterId: lL!._id, offspringId: `${motherLow}_o${i}`, sex: Sex.Male });
        if (i < 1) await concept.recordWeaning({ offspringId: offspring!._id });
        else await concept.recordDeath({ offspringId: offspring!._id });
      } // 1 litter, 5 born, 1 weaned (20% rate), avg: 5

      // M_CONCERN: High death rate (8 born, 4 weaned, 4 died)
      const { litter: lC } = await concept.recordLitter({ motherId: motherConcern, birthDate: new Date("2023-01-03"), reportedLitterSize: 8 });
      for (let i = 0; i < 8; i++) {
        const { offspring } = await concept.recordOffspring({ litterId: lC!._id, offspringId: `${motherConcern}_o${i}`, sex: Sex.Female });
        if (i < 4) await concept.recordWeaning({ offspringId: offspring!._id });
        else await concept.recordDeath({ offspringId: offspring!._id });
      } // 1 litter, 8 born, 4 weaned (50% rate), 50% deaths, avg: 8

      // M_AVG: Average performance (6 born, 4 weaned, 2 died)
      const { litter: lA } = await concept.recordLitter({ motherId: motherAverage, birthDate: new Date("2023-01-04"), reportedLitterSize: 6 });
      for (let i = 0; i < 6; i++) {
        const { offspring } = await concept.recordOffspring({ litterId: lA!._id, offspringId: `${motherAverage}_o${i}`, sex: Sex.Male });
        if (i < 4) await concept.recordWeaning({ offspringId: offspring!._id });
        else await concept.recordDeath({ offspringId: offspring!._id });
      } // 1 litter, 6 born, 4 weaned (66.67% rate), avg: 6

      const reportName = "Performers Classification Report";
      await concept.generateReport({
        target: [motherHigh, motherLow, motherConcern, motherAverage],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: reportName,
      });

      const { summary, error } = await concept.aiSummary({ reportName });
      assertEquals(error, undefined);
      assertExists(summary);

      const parsedSummary = JSON.parse(summary);
      assertEquals(parsedSummary.highPerformers, [motherHigh]);
      assertEquals(parsedSummary.lowPerformers, [motherLow]);
      assertEquals(parsedSummary.concerningTrends, [motherConcern]);
      assertEquals(parsedSummary.averagePerformers.sort(), [motherAverage].sort());
      assertEquals(parsedSummary.potentialRecordErrors, []);
      assertExists(parsedSummary.insights);
    });

    await t.step("should handle noticing record errors well", async () => {
      const motherErrorWeanedMore = "M_ERR_WEANED_MORE";
      const motherErrorExtremelyLowAvg = "M_ERR_LOW_AVG";
      const motherErrorExtremelyHighAvg = "M_ERR_HIGH_AVG";

      await concept.addMother({ motherId: motherErrorWeanedMore });
      await concept.addMother({ motherId: motherErrorExtremelyLowAvg });
      await concept.addMother({ motherId: motherErrorExtremelyHighAvg });

      // M_ERR_WEANED_MORE: Simulate weaned > born (will be corrected by mock to show 1 more weaned than born)
      const { litter: lEW } = await concept.recordLitter({ motherId: motherErrorWeanedMore, birthDate: new Date("2023-02-01"), reportedLitterSize: 2 });
      const { offspring: oEW1 } = await concept.recordOffspring({ litterId: lEW!._id, offspringId: `${motherErrorWeanedMore}_o1`, sex: Sex.Female });
      await concept.recordWeaning({ offspringId: oEW1!._id });
      // Manually insert a record for another offspring that is weaned but not born to simulate the error.
      // This directly manipulates the collection to force the error state for the mock to detect.
      await db.collection("ReproductionTracking.offspring").insertOne({
          _id: `${motherErrorWeanedMore}_o2`,
          litterId: lEW!._id,
          sex: Sex.Male,
          notes: "Simulated extra weaned offspring",
          isAlive: true,
          survivedTillWeaning: true, // This makes totalWeanedOffspring 2, while totalOffspringBorn is 1
      });


      // M_ERR_LOW_AVG: Very low average actual offspring (1 offspring over 5 litters)
      const motherErrorExtremelyLowAvgId = motherErrorExtremelyLowAvg;
      for (let i = 0; i < 5; i++) {
          const { litter: lEL } = await concept.recordLitter({ motherId: motherErrorExtremelyLowAvgId, birthDate: new Date(`2023-02-0${2 + i}`), reportedLitterSize: 5 });
          if (i === 0) { // Only one offspring born across 5 litters
              const { offspring: oEL1 } = await concept.recordOffspring({ litterId: lEL!._id, offspringId: `${motherErrorExtremelyLowAvgId}_o1`, sex: Sex.Female });
              await concept.recordWeaning({ offspringId: oEL1!._id });
          }
      } // 5 litters, 1 born, 1 weaned -> avg actual offspring per litter = 1/5 = 0.2

      // M_ERR_HIGH_AVG: Extremely high average actual offspring (e.g., 20 offspring in one litter)
      const { litter: lEH } = await concept.recordLitter({ motherId: motherErrorExtremelyHighAvg, birthDate: new Date("2023-02-07"), reportedLitterSize: 20 });
      for (let i = 0; i < 20; i++) {
        const { offspring } = await concept.recordOffspring({ litterId: lEH!._id, offspringId: `${motherErrorExtremelyHighAvg}_o${i}`, sex: Sex.Male });
        await concept.recordWeaning({ offspringId: offspring!._id });
      } // 1 litter, 20 born, 20 weaned -> avg actual offspring per litter = 20

      const reportName = "Record Errors Report";
      await concept.generateReport({
        target: [motherErrorWeanedMore, motherErrorExtremelyLowAvg, motherErrorExtremelyHighAvg],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: reportName,
      });

      const { summary, error } = await concept.aiSummary({ reportName });
      assertEquals(error, undefined);
      assertExists(summary);

      const parsedSummary = JSON.parse(summary);
      assertEquals(parsedSummary.potentialRecordErrors.sort(), [motherErrorWeanedMore, motherErrorExtremelyLowAvg, motherErrorExtremelyHighAvg].sort());
      assertEquals(parsedSummary.highPerformers, []);
      assertEquals(parsedSummary.lowPerformers, []);
      assertEquals(parsedSummary.concerningTrends, []);
      assertEquals(parsedSummary.averagePerformers, []); // No average performers if all are errors
      assertExists(parsedSummary.insights);
    });

    await t.step("should generate an AI summary for a large report with many mothers/litters", async () => {
      const numMothers = 50;
      const targetMothers: string[] = [];
      for (let i = 0; i < numMothers; i++) {
        const motherId = `LargeReportMother_${i}`;
        targetMothers.push(motherId);
        await concept.addMother({ motherId });

        // Each mother has 2 litters
        for (let j = 0; j < 2; j++) {
          const birthDate = new Date(`2023-${(i % 12) + 1}-${(j % 28) + 1}`);
          const reportedSize = Math.floor(Math.random() * 5) + 3; // 3-7 reported size
          const { litter } = await concept.recordLitter({ motherId, birthDate, reportedLitterSize: reportedSize });

          // Each litter has 3-5 offspring
          const actualBorn = Math.floor(Math.random() * 3) + 3; // 3-5 actual born
          for (let k = 0; k < actualBorn; k++) {
            const offspringId = `${motherId}_l${j}_o${k}`;
            const sex = k % 2 === 0 ? Sex.Male : Sex.Female;
            const { offspring } = await concept.recordOffspring({ litterId: litter!._id, offspringId, sex });

            // Randomly assign weaning/death outcomes
            if (Math.random() < 0.7) { // 70% chance to be weaned
              await concept.recordWeaning({ offspringId: offspring!._id });
            } else if (Math.random() < 0.9) { // 20% chance to die (10% remain alive, not weaned)
              await concept.recordDeath({ offspringId: offspring!._id });
            }
          }
        }
      }

      const reportName = "Large Data Report";
      await concept.generateReport({
        target: targetMothers,
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: reportName,
      });

      const { summary, error } = await concept.aiSummary({ reportName });
      assertEquals(error, undefined);
      assertExists(summary);

      const parsedSummary = JSON.parse(summary);
      assertExists(parsedSummary.highPerformers);
      assertExists(parsedSummary.lowPerformers);
      assertExists(parsedSummary.concerningTrends);
      assertExists(parsedSummary.averagePerformers);
      assertExists(parsedSummary.potentialRecordErrors);
      assertExists(parsedSummary.insights);

      // Basic sanity check: all mothers should be classified into *some* category
      const allClassified = new Set([
          ...parsedSummary.highPerformers,
          ...parsedSummary.lowPerformers,
          ...parsedSummary.concerningTrends,
          ...parsedSummary.averagePerformers,
          ...parsedSummary.potentialRecordErrors,
      ]);
      assertEquals(allClassified.size, numMothers, `Expected ${numMothers} classified mothers, got ${allClassified.size}`);
    });


    await t.step("should return an error if report does not exist", async () => {
      const { summary, error } = await concept.aiSummary({ reportName: "Non Existent AI Report" });
      assertEquals(summary, undefined);
      assertEquals(error, "Report with name 'Non Existent AI Report' not found.");
    });

    await t.step("should return an error if GEMINI_API_KEY is not set", async () => {
      Deno.env.delete("GEMINI_API_KEY");
      const { summary, error } = await concept.aiSummary({ reportName: "Performers Classification Report" }); // Use an existing report
      assertEquals(summary, undefined);
      assertEquals(error, "GEMINI_API_KEY environment variable is not set.");
      Deno.env.set("GEMINI_API_KEY", "MOCK_API_KEY"); // Reset for subsequent tests
    });
  });

  await t.step("Principle Trace: Recording a full reproductive cycle and reporting", async () => {
    const motherId = "principleMother";
    const fatherId = "principleFather";
    const birthDate1 = new Date("2023-01-15");
    const birthDate2 = new Date("2023-07-20");

    // 1. a user records birth events by first creating a litter for a mother animal,
    // optionally linking a father and setting an expected litter size;
    const { litter: litter1 } = await concept.recordLitter({
      motherId,
      fatherId,
      birthDate: birthDate1,
      reportedLitterSize: 6,
      notes: "First litter for principleMother",
    });
    assertExists(litter1);
    assertEquals(litter1.motherId, motherId);
    assertEquals(litter1.reportedLitterSize, 6);

    const { litter: litter2 } = await concept.recordLitter({
      motherId,
      birthDate: birthDate2,
      reportedLitterSize: 4,
      notes: "Second litter for principleMother",
    });
    assertExists(litter2);
    assertEquals(litter2.motherId, motherId);
    assertEquals(litter2.reportedLitterSize, 4);

    // Verification that mother was implicitly added (or already existed)
    // Attempting to add the same mother again should yield an error
    const { error: duplicateMotherError } = await concept.addMother({ motherId });
    assertExists(duplicateMotherError);
    assertEquals(duplicateMotherError, "Mother with ID principleMother already exists.");

    // 2. then, individual offspring born to that litter are recorded and linked to it;
    const offspringIds1: string[] = []; // Explicitly type as string[]
    for (let i = 0; i < 5; i++) { // 5 live births for litter1
      const sex = i % 2 === 0 ? Sex.Male : Sex.Female;
      const { offspring } = await concept.recordOffspring({
        litterId: litter1._id,
        offspringId: `o1-${i}`,
        sex,
        notes: `Offspring ${i} of litter1`,
      });
      assertExists(offspring);
      offspringIds1.push(offspring!._id);
    }

    const offspringIds2: string[] = []; // Explicitly type as string[]
    for (let i = 0; i < 4; i++) { // 4 live births for litter2
      const sex = i % 2 === 0 ? Sex.Female : Sex.Male;
      const { offspring } = await concept.recordOffspring({
        litterId: litter2._id,
        offspringId: `o2-${i}`,
        sex,
        notes: `Offspring ${i} of litter2`,
      });
      assertExists(offspring);
      offspringIds2.push(offspring!._id);
    }

    // Verify offspring counts for each litter using viewOffspringOfLitter
    const { offspring: litter1Offspring } = await concept.viewOffspringOfLitter({ litterId: litter1._id });
    assertEquals(litter1Offspring?.length, 5);
    const { offspring: litter2Offspring } = await concept.viewOffspringOfLitter({ litterId: litter2._id });
    assertEquals(litter2Offspring?.length, 4);


    // 3. later records weaning outcomes for those offspring when the data becomes available;
    // For litter1: 3 weaned, 1 died, 1 no status (still alive, not weaned)
    await concept.recordWeaning({ offspringId: offspringIds1[0] });
    await concept.recordWeaning({ offspringId: offspringIds1[1] });
    await concept.recordWeaning({ offspringId: offspringIds1[2] });
    await concept.recordDeath({ offspringId: offspringIds1[3] }); // Died before weaning

    // For litter2: 3 weaned, 1 died
    await concept.recordWeaning({ offspringId: offspringIds2[0] });
    await concept.recordWeaning({ offspringId: offspringIds2[1] });
    await concept.recordWeaning({ offspringId: offspringIds2[2] });
    await concept.recordDeath({ offspringId: offspringIds2[3] });

    // Verify weaning/death status for a sample offspring using viewOffspringOfLitter
    const { offspring: updatedLitter1Offspring } = await concept.viewOffspringOfLitter({ litterId: litter1._id });
    const o1_0_status = updatedLitter1Offspring?.find(o => o._id === offspringIds1[0]);
    assertExists(o1_0_status);
    assertEquals(o1_0_status.survivedTillWeaning, true);
    assertEquals(o1_0_status.isAlive, true);

    const o1_3_status = updatedLitter1Offspring?.find(o => o._id === offspringIds1[3]);
    assertExists(o1_3_status);
    assertEquals(o1_3_status.survivedTillWeaning, false);
    assertEquals(o1_3_status.isAlive, false); // Died

    const o1_4_status = updatedLitter1Offspring?.find(o => o._id === offspringIds1[4]);
    assertExists(o1_4_status);
    assertEquals(o1_4_status.survivedTillWeaning, false); // Not weaned
    assertEquals(o1_4_status.isAlive, true); // Still alive


    // 4. uses this data to generate reports to evaluate reproductive performance and inform breeding decisions,
    // including litter-specific metrics;
    const reportName = "Principle Trace Report";
    const { report, error: generateReportError } = await concept.generateReport({
      target: [motherId],
      startDateRange: new Date("2023-01-01"),
      endDateRange: new Date("2023-12-31"),
      name: reportName,
    });
    assertEquals(generateReportError, undefined);
    assertExists(report);
    assertEquals(report.reportName, reportName);
    assertEquals(report.target, [motherId]);

    // Expected overall metrics
    // Litters recorded: 2
    // Reported litter size: 6 + 4 = 10
    // Actual offspring born: 5 + 4 = 9
    // Weaned offspring: 3 (from litter1) + 3 (from litter2) = 6
    // Deceased offspring: 1 (from litter1) + 1 (from litter2) = 2
    assertObjectMatch(report.results as unknown as Record<PropertyKey, unknown>, {
      uniqueLittersRecorded: 2,
      totalReportedLitterSize: 10,
      totalActualOffspringBorn: 9,
      totalWeanedOffspring: 6,
      totalDeceasedOffspring: 2,
      averageReportedLitterSize: 5, // 10 / 2
      averageActualOffspringPerLitter: 4.5, // 9 / 2
      survivabilityRateToWeaning: (6 / 9 * 100).toFixed(2) + "%", // ~66.67%
      motherCount: 1,
    } as unknown as Record<PropertyKey, unknown>);

    // Per-mother metrics for principleMother
    const mPerf = report.results.perMotherPerformance.find(p => p.motherId === motherId);
    assertExists(mPerf);
    assertObjectMatch(mPerf as unknown as Record<PropertyKey, unknown>, {
      littersRecorded: 2,
      totalOffspringBorn: 9,
      totalOffspringWeaned: 6,
      totalDeceasedOffspring: 2,
      weaningSurvivabilityRate: (6 / 9 * 100).toFixed(2) + "%", // ~66.67%
      averageActualOffspringPerLitter: 4.5,
    } as unknown as Record<PropertyKey, unknown>);

    // Verify report can be viewed
    const { report: viewedReport, error: viewReportError } = await concept.viewReport({ reportName });
    assertEquals(viewReportError, undefined);
    assertObjectMatch(viewedReport! as unknown as Record<PropertyKey, unknown>, report as unknown as Record<PropertyKey, unknown>);
  });
});
```
