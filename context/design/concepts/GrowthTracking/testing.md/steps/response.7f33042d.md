---
timestamp: 'Sat Oct 18 2025 18:41:59 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_184159.cba8fd31.md]]'
content_id: 7f33042d9e56249808b233dc30d9b4b14f1ec869ec7338a907528ae0ccd4a9fb
---

# response:

Okay, that's an excellent request! Testing AI-driven features, especially their classification and summary capabilities, is crucial. The non-deterministic nature of LLMs means we can't expect exact string matches, but we can assert the presence of key information and the correct classification of entities.

I've created a new test file `src/GrowthTracking/GrowthTrackingConcept.ai.test.ts` that sets up specific scenarios designed to trigger the AI's classification rules for high/low performers, potential errors, and data limitations.

**Key considerations in these tests:**

* **`GEMINI_API_KEY`**: The tests include a check for the `GEMINI_API_KEY` environment variable. If it's not set, the AI-specific tests will be skipped, which is useful for local development or CI environments where the key might not always be available.
* **LLM Output Validation**: After receiving the AI summary, the tests parse the JSON and then assert:
  * The presence of the expected top-level arrays (`highPerformers`, `lowPerformers`, etc.) and the `insights` string.
  * That specific animal IDs are included in the *correct* classification arrays based on the data provided to the AI.
  * That the `insights` string contains relevant keywords or phrases, using `toLowerCase().includes()` for flexibility.
* **Scenario Design**: The scenarios are crafted to create clear examples for the AI to classify:
  * **Mixed Performance**: Animals with distinct high, low (negative), and average growth patterns.
  * **Potential Record Error**: An animal with a clearly anomalous weight record (e.g., an impossibly high value).
  * **Sparse/Incomplete Data**: Animals with either very few records, or records outside the report's date range. The prompt instructs the AI to classify all animals, so these should appear, likely in `averagePerformers` or `concerningTrends`, with insights reflecting the data limitations.

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
  insights: string;
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
    assertExists(parsedSummary.insights, "insights field expected");

    // Assert specific animals are in the correct categories
    assertEquals(parsedSummary.highPerformers.includes(animalAlpha), true, `Animal ${animalAlpha} should be a high performer`);
    // Beta should be in lowPerformers or concerningTrends due to weight loss
    assertEquals(parsedSummary.lowPerformers.includes(animalBeta) || parsedSummary.concerningTrends.includes(animalBeta), true, `Animal ${animalBeta} should be a low performer or concerning trend`);
    assertEquals(parsedSummary.averagePerformers.includes(animalGamma), true, `Animal ${animalGamma} should be an average performer`);

    // Check insights for keywords related to the performance
    assertNotEquals(parsedSummary.insights.length, 0, "Insights should not be empty");
    assertEquals(parsedSummary.insights.toLowerCase().includes(animalAlpha.toLowerCase()), true, `Insights should mention ${animalAlpha}`);
    assertEquals(parsedSummary.insights.toLowerCase().includes(animalBeta.toLowerCase()), true, `Insights should mention ${animalBeta}`);
    assertEquals(parsedSummary.insights.toLowerCase().includes(animalGamma.toLowerCase()), true, `Insights should mention ${animalGamma}`);
    assertEquals(parsedSummary.insights.toLowerCase().includes("positive growth") || parsedSummary.insights.toLowerCase().includes("strong growth"), true, "Insights should mention positive growth for high performers");
    assertEquals(parsedSummary.insights.toLowerCase().includes("weight loss") || parsedSummary.insights.toLowerCase().includes("negative growth") || parsedSummary.insights.toLowerCase().includes("decline"), true, "Insights should mention weight loss for low performers");
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

    // Check insights for mention of record errors/anomalies
    assertNotEquals(parsedSummary.insights.length, 0, "Insights should not be empty");
    assertEquals(parsedSummary.insights.toLowerCase().includes("record error") || parsedSummary.insights.toLowerCase().includes("inconsistent data") || parsedSummary.insights.toLowerCase().includes("anomalous weight") || parsedSummary.insights.toLowerCase().includes("suspicious record"), true, "Insights should discuss the record anomaly for Delta");
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


    // Check insights for discussion on data limitations
    assertNotEquals(parsedSummary.insights.length, 0, "Insights should not be empty");
    assertEquals(parsedSummary.insights.toLowerCase().includes("limited data") || parsedSummary.insights.toLowerCase().includes("sparse records") || parsedSummary.insights.toLowerCase().includes("insufficient data") || parsedSummary.insights.toLowerCase().includes("data gaps"), true, "Insights should mention data limitations");
  });

  await client.close();
});
```
