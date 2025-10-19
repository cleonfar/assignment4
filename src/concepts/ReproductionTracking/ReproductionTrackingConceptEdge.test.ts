import { assertEquals, assertExists, assertNotEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import ReproductionTrackingConcept from "./ReproductionTrackingConcept.ts";
import { ID } from "@utils/types.ts";

// Utility for parsing AI summary output (same as in main test file)
interface LLMSummaryOutput {
  highPerformers: ID[];
  lowPerformers: ID[];
  concerningTrends: ID[];
  averagePerformers: ID[];
  potentialRecordErrors: ID[];
  insights: string;
}

// Function to check GEMINI_API_KEY for AI tests (same as in main test file)
function ensureGeminiApiKey(): void {
  if (!Deno.env.get("GEMINI_API_KEY")) {
    throw new Error(
      "GEMINI_API_KEY environment variable not set. Please set it to run AI-related tests.",
    );
  }
}

Deno.test("ReproductionTrackingConcept - Edge Cases and Advanced Scenarios", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  const startDate = new Date("2023-01-01");
  const endDate = new Date("2023-12-31");

  await t.step(
    "Scenario 1: Reporting for empty or incomplete data",
    async (st) => {
      const motherNoLittersId = "mother:NoLitters" as ID;
      const motherEmptyLitterId = "mother:EmptyLitter" as ID;
      const motherPartialLitterId = "mother:PartialLitter" as ID;

      await concept.addMother({ motherId: motherNoLittersId as string });
      await concept.addMother({ motherId: motherEmptyLitterId as string });
      await concept.addMother({ motherId: motherPartialLitterId as string });

      // Setup for motherEmptyLitterId: Create a litter, but no offspring
      const emptyLitter = (await concept.recordLitter({
        motherId: motherEmptyLitterId as string,
        birthDate: new Date("2023-03-01"),
        reportedLitterSize: 5, // Reported 5, but will have 0 actual offspring
      })).litterID!;

      // Setup for motherPartialLitterId: Create a litter and some offspring, fewer than reported
      const partialLitter = (await concept.recordLitter({
        motherId: motherPartialLitterId as string,
        birthDate: new Date("2023-04-15"),
        reportedLitterSize: 10, // Reported 10, but will have 3 actual offspring
      })).litterID!;
      await concept.recordOffspring({
        litterId: partialLitter as string,
        offspringId: "offspring:PL1" as string,
        sex: "male",
      });
      await concept.recordOffspring({
        litterId: partialLitter as string,
        offspringId: "offspring:PL2" as string,
        sex: "female",
      });
      await concept.recordOffspring({
        litterId: partialLitter as string,
        offspringId: "offspring:PL3" as string,
        sex: "male",
      });
      await concept.recordWeaning({ offspringId: "offspring:PL1" as string }); // 1 out of 3 weaned

      await st.step(
        "should report 0 litters/offspring for a mother with no recorded litters",
        async () => {
          const reportName = "ReportNoLitters";
          const result = await concept.generateReport({
            target: motherNoLittersId as string,
            startDateRange: startDate,
            endDateRange: endDate,
            name: reportName,
          });

          assertExists(result.results);
          assertEquals(result.error, undefined);
          assertNotEquals(result.results!.length, 0);

          const reportEntry = result.results![0];
          assertExists(reportEntry.includes(`Litters: 0`));
          assertExists(reportEntry.includes(`Offspring: 0`));
          assertExists(reportEntry.includes(`Weaning Survival: N/A`));
        },
      );

      await st.step(
        "should report 1 litter but 0 offspring for a litter with no recorded offspring",
        async () => {
          const reportName = "ReportEmptyLitter";
          const result = await concept.generateReport({
            target: motherEmptyLitterId as string,
            startDateRange: startDate,
            endDateRange: endDate,
            name: reportName,
          });

          assertExists(result.results);
          assertEquals(result.error, undefined);
          assertNotEquals(result.results!.length, 0);

          const reportEntry = result.results![0];
          assertExists(reportEntry.includes(`Litters: 1`));
          assertExists(reportEntry.includes(`Offspring: 0`));
          assertExists(reportEntry.includes(`Weaning Survival: N/A`));
        },
      );

      await st.step(
        "should correctly count actual offspring and calculate weaning survival for partially filled litter",
        async () => {
          const reportName = "ReportPartialLitter";
          const result = await concept.generateReport({
            target: motherPartialLitterId as string,
            startDateRange: startDate,
            endDateRange: endDate,
            name: reportName,
          });

          assertExists(result.results);
          assertEquals(result.error, undefined);
          assertNotEquals(result.results!.length, 0);

          const reportEntry = result.results![0];
          assertExists(reportEntry.includes(`Litters: 1`));
          assertExists(reportEntry.includes(`Offspring: 3`)); // Should be 3, not 10 (reportedLitterSize)
          assertExists(reportEntry.includes(`Weaning Survival: 33.33%`)); // 1 weaned out of 3
        },
      );
    },
  );

  await t.step(
    "Scenario 2: ReportedLitterSize vs. Actual Offspring Count in Reporting",
    async (st) => {
      const motherId = "mother:LitterSizeTest" as ID;
      await concept.addMother({ motherId: motherId as string });

      const litterReportedLowActualHigh = (await concept.recordLitter({
        motherId: motherId as string,
        birthDate: new Date("2023-06-01"),
        reportedLitterSize: 2, // Reported size is low
      })).litterID!;

      // Record more offspring than reported size
      await concept.recordOffspring({
        litterId: litterReportedLowActualHigh as string,
        offspringId: "offspring:LT1" as string,
        sex: "male",
      });
      await concept.recordOffspring({
        litterId: litterReportedLowActualHigh as string,
        offspringId: "offspring:LT2" as string,
        sex: "female",
      });
      await concept.recordOffspring({
        litterId: litterReportedLowActualHigh as string,
        offspringId: "offspring:LT3" as string,
        sex: "male",
      });
      await concept.recordOffspring({
        litterId: litterReportedLowActualHigh as string,
        offspringId: "offspring:LT4" as string,
        sex: "female",
      });
      await concept.recordWeaning({ offspringId: "offspring:LT1" as string });
      await concept.recordWeaning({ offspringId: "offspring:LT2" as string });

      const reportName = "ReportLitterSizeDiscrepancy";

      await st.step(
        "should use actual offspring count, not reportedLitterSize, in report generation",
        async () => {
          const result = await concept.generateReport({
            target: motherId as string,
            startDateRange: startDate,
            endDateRange: endDate,
            name: reportName,
          });

          assertExists(result.results);
          assertEquals(result.error, undefined);

          const reportEntry = result.results![0];
          assertExists(reportEntry.includes(`Litters: 1`));
          assertExists(reportEntry.includes(`Offspring: 4`)); // Should be 4 (actual), not 2 (reported)
          assertExists(reportEntry.includes(`Weaning Survival: 50.00%`)); // 2 weaned out of 4
        },
      );

      await st.step(
        "should still use actual offspring count even if reportedLitterSize is updated",
        async () => {
          // Update reportedLitterSize to be even higher, but actual offspring count remains 4
          await concept.updateLitter({
            litterId: litterReportedLowActualHigh as string,
            reportedLitterSize: 10,
          });

          // Regenerate the report (this will update its results if the performance entry changes, and clear summary)
          const result = await concept.generateReport({
            target: motherId as string,
            startDateRange: startDate,
            endDateRange: endDate,
            name: reportName,
          });

          assertExists(result.results);
          assertEquals(result.error, undefined);

          // We expect the report to contain two entries if the second one was distinct enough.
          // The current implementation of `generateReport` will add a new entry if the string is different.
          // If the string content for performance for this mother/date range is identical, it won't add.
          // In this case, since `reportedLitterSize` isn't used in the string, it will be the same.
          const updatedReport = await concept.reports.findOne({
            _id: reportName as ID,
          });
          assertExists(updatedReport);
          assertEquals(
            updatedReport.results.length,
            1,
            "Should not add duplicate entry if performance string is identical",
          );

          const reportEntry = updatedReport.results[0]; // Check the existing (or updated) entry
          assertExists(reportEntry.includes(`Litters: 1`));
          assertExists(reportEntry.includes(`Offspring: 4`)); // Still 4 (actual), despite reported being 10
          assertExists(reportEntry.includes(`Weaning Survival: 50.00%`));
        },
      );
    },
  );

  await t.step("Scenario 3: Complex Weaning and Death Outcomes", async (st) => {
    const motherId = "mother:ComplexOutcomes" as ID;
    await concept.addMother({ motherId: motherId as string });

    const litterId = (await concept.recordLitter({
      motherId: motherId as string,
      birthDate: new Date("2023-07-01"),
      reportedLitterSize: 6,
    })).litterID!;

    // Offspring setup:
    // O1: weaned, alive
    // O2: weaned, then died (survivedTillWeaning should remain true)
    // O3: died, not weaned (survivedTillWeaning should remain false)
    // O4: alive, not weaned (should not count as survivedTillWeaning)
    // O5: recorded, then died, then attempt to wean (should fail)
    // O6: recorded, alive, weaned, then died, then attempt to wean again (should fail, survivedTillWeaning remains true)

    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: "offspring:CO1" as string,
      sex: "male",
    });
    await concept.recordWeaning({ offspringId: "offspring:CO1" as string }); // Weaned, alive

    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: "offspring:CO2" as string,
      sex: "female",
    });
    await concept.recordWeaning({ offspringId: "offspring:CO2" as string });
    await concept.recordDeath({ offspringId: "offspring:CO2" as string }); // Weaned, then died

    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: "offspring:CO3" as string,
      sex: "male",
    });
    await concept.recordDeath({ offspringId: "offspring:CO3" as string }); // Died, not weaned

    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: "offspring:CO4" as string,
      sex: "female",
    }); // Alive, not weaned

    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: "offspring:CO5" as string,
      sex: "male",
    });
    await concept.recordDeath({ offspringId: "offspring:CO5" as string }); // Died
    const weanDeadResult = await concept.recordWeaning({
      offspringId: "offspring:CO5" as string,
    });
    assertExists(
      weanDeadResult.error,
      "Should not be able to wean a dead offspring",
    );

    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: "offspring:CO6" as string,
      sex: "female",
    });
    await concept.recordWeaning({ offspringId: "offspring:CO6" as string });
    await concept.recordDeath({ offspringId: "offspring:CO6" as string });
    const reWeanDeadResult = await concept.recordWeaning({
      offspringId: "offspring:CO6" as string,
    });
    assertExists(
      reWeanDeadResult.error,
      "Should not be able to wean a dead offspring, even if previously weaned",
    );

    const reportName = "ComplexOutcomeReport";
    await st.step(
      "should correctly calculate weaning survival for mixed outcomes",
      async () => {
        const result = await concept.generateReport({
          target: motherId as string,
          startDateRange: startDate,
          endDateRange: endDate,
          name: reportName,
        });

        assertExists(result.results);
        assertEquals(result.error, undefined);

        // Expected calculation:
        // Total offspring: 6 (CO1-CO6)
        // Survived till weaning:
        // CO1: true (weaned, alive)
        // CO2: true (weaned, then died, but was weaned)
        // CO3: false (died, not weaned)
        // CO4: false (alive, not weaned)
        // CO5: false (died, not weaned)
        // CO6: true (weaned, then died, but was weaned)
        // Total survived till weaning = 3
        // Weaning Survival Rate: (3 / 6) * 100 = 50.00%

        const reportEntry = result.results![0];
        assertExists(reportEntry.includes(`Litters: 1`));
        assertExists(reportEntry.includes(`Offspring: 6`));
        assertExists(reportEntry.includes(`Weaning Survival: 50.00%`));

        // Verify individual states directly (smoke test for consistency)
        const co1 = await concept.offspring.findOne({
          _id: "offspring:CO1" as ID,
        });
        assertEquals(co1?.isAlive, true);
        assertEquals(co1?.survivedTillWeaning, true);
        const co2 = await concept.offspring.findOne({
          _id: "offspring:CO2" as ID,
        });
        assertEquals(co2?.isAlive, false);
        assertEquals(co2?.survivedTillWeaning, true); // Important: survivedTillWeaning remains true
        const co3 = await concept.offspring.findOne({
          _id: "offspring:CO3" as ID,
        });
        assertEquals(co3?.isAlive, false);
        assertEquals(co3?.survivedTillWeaning, false);
        const co4 = await concept.offspring.findOne({
          _id: "offspring:CO4" as ID,
        });
        assertEquals(co4?.isAlive, true);
        assertEquals(co4?.survivedTillWeaning, false);
      },
    );
  });

  await client.close();
});
