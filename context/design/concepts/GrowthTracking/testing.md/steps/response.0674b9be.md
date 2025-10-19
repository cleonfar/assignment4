---
timestamp: 'Sat Oct 18 2025 19:15:03 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_191503.c4346a95.md]]'
content_id: 0674b9beed73f28e55e01ba6faec09601855481471367a694b267472ca92ffc0
---

# response:

You're right. While the `insights` are valuable for a user, they are free-form text and highly non-deterministic from an LLM. Directly asserting their content can lead to flaky tests. The more reliable and actionable part of the AI's response for automated testing is the structured classification into categories like `highPerformers`, `lowPerformers`, etc., which the prompt strictly enforces.

I've updated the `src/GrowthTracking/GrowthTrackingConcept.ai.test.ts` file to remove all assertions related to the content of the `insights` field. The tests will still verify that the structured classification arrays contain the correct animal IDs.

Here's the updated test file:

***

### `# file: src/GrowthTracking/GrowthTrackingConcept.ai.test.ts`

```typescript
import { assertEquals, assertExists, assertNotEquals } from "jsr:@std/assert";
import { testDb } from "../../utils/database.ts"; // Adjust path as necessary
import GrowthTrackingConcept from "./GrowthTrackingConcept.ts";
import { ID } from "../../utils/types.ts";

// Helper to determine if an object is an error object
function isError(
  response: Record<string, unknown>,
): response is { error: string } {
  return "error" in response;
}

// Interface for the expected LLM output structure for easier type checking in tests
interface LLMSummaryOutput {
  highPerformers: string[];
  lowPerformers: string[];
  concerningTrends: string[];
  averagePerformers: string[];
  potentialRecordErrors: string[];
  insights: string; // Still exists in the output structure, but we won't assert its content
}

Deno.test("GrowthTrackingConcept - AI Scenarios", async (t) => {
  const [db, client] = await testDb();
  const concept = new GrowthTrackingConcept(db);

  // Setup GEMINI_API_KEY for testing
  // In a real scenario, this would be set in .env or via Deno.env.
  // For CI/CD, ensure this environment variable is provided.
  if (!Deno.env.get("GEMINI_API_KEY")) {
    console.warn("Skipping AI tests: GEMINI_API_KEY is not set.");
    await client.close();
    return; // Skip tests if API key is not available
  }

  const reportPeriodStart = new Date("2024-01-01T00:00:00.000Z");
  const reportPeriodEnd = new Date("2024-01-31T00:00:00.000Z");

  // --- Scenario 1: Mixed Performance Report ---
  await t.step("Scenario 1: Mixed performance (high, low, average) should be correctly identified by AI", async () => {
    const animalAlpha: ID = "animal:Alpha" as ID; // High performer
    const animalBeta: ID = "animal:Beta" as ID; // Low/negative performer
    const animalGamma: ID = "animal:Gamma" as ID; // Average performer
    const scenario1ReportName = "MixedPerformanceReport";

    // Data for Alpha (High Performer) - Strong positive ADG
    await concept.recordWeight({ animal: animalAlpha, date: new Date("2024-01-01"), weight: 100, notes: "" });
    await concept.recordWeight({ animal: animalAlpha, date: new Date("2024-01-10"), weight: 120, notes: "" }); // +20 in 9 days
    await concept.recordWeight({ animal: animalAlpha, date: new Date("2024-01-20"), weight: 145, notes: "" }); // +25 in 10 days

    // Data for Beta (Low/Negative Performer) - Weight loss
    await concept.recordWeight({ animal: animalBeta, date: new Date("2024-01-01"), weight: 80, notes: "" });
    await concept.recordWeight({ animal: animalBeta, date: new Date("2024-01-10"), weight: 78, notes: "" }); // -2 in 9 days
    await concept.recordWeight({ animal: animalBeta, date: new Date("2024-01-20"), weight: 75, notes: "" }); // -3 in 10 days

    // Data for Gamma (Average Performer) - Small, steady positive ADG
    await concept.recordWeight({ animal: animalGamma, date: new Date("2024-01-01"), weight: 60, notes: "" });
    await concept.recordWeight({ animal: animalGamma, date: new Date("2024-01-15"), weight: 62, notes: "" }); // +2 in 14 days
    await concept.recordWeight({ animal: animalGamma, date: new Date("2024-01-30"), weight: 64, notes: "" }); // +2 in 15 days

    // Generate report for Alpha
    await concept.generateReport({ animal: animalAlpha, startDateRange: reportPeriodStart, endDateRange: reportPeriodEnd, reportName: scenario1ReportName });
    // Update report for Beta
    await concept.generateReport({ animal: animalBeta, startDateRange: reportPeriodStart, endDateRange: reportPeriodEnd, reportName: scenario1ReportName });
    // Update report for Gamma
    await concept.generateReport({ animal: animalGamma, startDateRange: reportPeriodStart, endDateRange: reportPeriodEnd, reportName: scenario1ReportName });

    const aiResult = await concept.aiSummary({ reportName: scenario1ReportName });
    if (isError(aiResult)) {
      throw new Error(`AI summary failed: ${aiResult.error}`);
    }

    let parsedSummary: LLMSummaryOutput;
    try {
      parsedSummary = JSON.parse(aiResult.summary);
    } catch (e: unknown) {
      throw new Error(`AI summary is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }

    assertExists(parsedSummary.highPerformers, "highPerformers field expected");
    assertExists(parsedSummary.lowPerformers, "lowPerformers field expected");
    assertExists(parsedSummary.averagePerformers, "averagePerformers field expected");
    assertExists(parsedSummary.concerningTrends, "concerningTrends field expected");
    assertExists(parsedSummary.insights, "insights field expected (content not asserted)"); // Still check existence

    // Assert specific animals are in the correct categories
    assertEquals(parsedSummary.highPerformers.includes(animalAlpha), true, `Animal ${animalAlpha} should be a high performer`);
    // Beta should be in lowPerformers or concerningTrends due to weight loss
    assertEquals(parsedSummary.lowPerformers.includes(animalBeta) || parsedSummary.concerningTrends.includes(animalBeta), true, `Animal ${animalBeta} should be a low performer or concerning trend`);
    assertEquals(parsedSummary.averagePerformers.includes(animalGamma), true, `Animal ${animalGamma} should be an average performer`);
  });

  // --- Scenario 2: Report with Potential Record Error ---
  await t.step("Scenario 2: Animal with potential record error should be identified by AI", async () => {
    const animalDelta: ID = "animal:Delta" as ID; // Potential record error
    const scenario2ReportName = "RecordErrorReport";

    // Data for Delta: normal start, then an impossibly high weight, then normal again
    await concept.recordWeight({ animal: animalDelta, date: new Date("2024-01-05"), weight: 100, notes: "Normal start" });
    await concept.recordWeight({ animal: animalDelta, date: new Date("2024-01-10"), weight: 5000, notes: "IMPOSSIBLE WEIGHT!" }); // Obvious error for most animals
    await concept.recordWeight({ animal: animalDelta, date: new Date("2024-01-15"), weight: 110, notes: "Back to normal" });
    await concept.recordWeight({ animal: animalDelta, date: new Date("2024-01-20"), weight: 115, notes: "Continuing normal growth" });


    await concept.generateReport({ animal: animalDelta, startDateRange: reportPeriodStart, endDateRange: reportPeriodEnd, reportName: scenario2ReportName });

    const aiResult = await concept.aiSummary({ reportName: scenario2ReportName });
    if (isError(aiResult)) {
      throw new Error(`AI summary failed: ${aiResult.error}`);
    }

    let parsedSummary: LLMSummaryOutput;
    try {
      parsedSummary = JSON.parse(aiResult.summary);
    } catch (e: unknown) {
      throw new Error(`AI summary is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }

    assertExists(parsedSummary.potentialRecordErrors, "potentialRecordErrors field expected");
    assertEquals(parsedSummary.potentialRecordErrors.includes(animalDelta), true, `Animal ${animalDelta} should be flagged as a potential record error`);
  });

  // --- Scenario 3: Report with Incomplete Data / Sparse Records ---
  await t.step("Scenario 3: Animals with sparse or single records should be handled gracefully by AI", async () => {
    const animalEpsilon: ID = "animal:Epsilon" as ID; // Single record in range
    const animalZeta: ID = "animal:Zeta" as ID; // Records only outside range, none inside
    const scenario3ReportName = "SparseDataReport";

    // Data for Epsilon: one record within range
    await concept.recordWeight({ animal: animalEpsilon, date: new Date("2024-01-15"), weight: 95, notes: "Single record" });
    await concept.recordWeight({ animal: animalEpsilon, date: new Date("2024-02-01"), weight: 100, notes: "Outside range" }); // Outside report period

    // Data for Zeta: records only outside range (will result in no relevant records for the report)
    await concept.recordWeight({ animal: animalZeta, date: new Date("2023-12-01"), weight: 70, notes: "Previous month" });
    await concept.recordWeight({ animal: animalZeta, date: new Date("2024-02-10"), weight: 72, notes: "Next month" });

    // Generate reports
    await concept.generateReport({ animal: animalEpsilon, startDateRange: reportPeriodStart, endDateRange: reportPeriodEnd, reportName: scenario3ReportName });
    await concept.generateReport({ animal: animalZeta, startDateRange: reportPeriodStart, endDateRange: reportPeriodEnd, reportName: scenario3ReportName });

    const aiResult = await concept.aiSummary({ reportName: scenario3ReportName });
    if (isError(aiResult)) {
      throw new Error(`AI summary failed: ${aiResult.error}`);
    }

    let parsedSummary: LLMSummaryOutput;
    try {
      parsedSummary = JSON.parse(aiResult.summary);
    } catch (e: unknown) {
      throw new Error(`AI summary is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }

    assertExists(parsedSummary.averagePerformers, "averagePerformers field expected");
    assertExists(parsedSummary.concerningTrends, "concerningTrends field expected");

    // Epsilon and Zeta will have null ADG. The prompt states "Every animal... must be classified into at least one...".
    // For these, 'averagePerformers' or 'concerningTrends' due to lack of growth data are the most logical.
    assertEquals(
        parsedSummary.averagePerformers.includes(animalEpsilon) || parsedSummary.concerningTrends.includes(animalEpsilon),
        true,
        `Animal ${animalEpsilon} (single record) should be classified (e.g., as average or concerning trend due to limited data)`,
    );
    assertEquals(
        parsedSummary.averagePerformers.includes(animalZeta) || parsedSummary.concerningTrends.includes(animalZeta),
        true,
        `Animal ${animalZeta} (no records in range) should be classified (e.g., as average or concerning trend due to limited data)`,
    );
  });

  await client.close();
});
```
