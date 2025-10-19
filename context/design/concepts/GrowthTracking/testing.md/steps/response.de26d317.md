---
timestamp: 'Sat Oct 18 2025 15:39:27 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_153927.1eee0f2f.md]]'
content_id: de26d3171b304b894617fd6af3672a3d8b50f1df26341675475f750feee7b292
---

# response:

The error "Parameter 'r' implicitly has an 'any' type" typically arises in TypeScript when a function parameter, especially in a callback, is not explicitly typed and TypeScript cannot infer its type from the context.

In your `GrowthTrackingConcept.ts` file, inside the `generateReport` action, you have this line:

```typescript
      const recordedWeights = relevantRecords.map((r) => ({
        date: r.date,
        weight: r.weight,
      }));
```

Here, `r` is a parameter in the `map` callback. The `relevantRecords` array is typed as `WeightRecord[]`. Therefore, `r` should be typed as `WeightRecord`.

Here's the corrected part of the `generateReport` action:

```typescript
// file: src/GrowthTracking/GrowthTrackingConcept.ts
// ... (rest of the file remains the same)

export default class GrowthTrackingConcept {
  // ... (rest of the class)

  /**
   * @action generateReport
   * @requires all target animals exist within the GrowthTracking concept's data
   * @effects If no report with this name exists then generate a report on the growth performance
   *          of the given animals within the specified date range, otherwise add the growth performance
   *          of this animal (or update if already present) to the existing report.
   *          The report should include each recorded weight of each animal as well as their average daily
   *          rate of gain over each time period.
   */
  async generateReport(
    { targetAnimals, startDateRange, endDateRange, name }: {
      targetAnimals: Animal[];
      startDateRange: Date;
      endDateRange: Date;
      name: string;
    },
  ): Promise<{ results: AnimalReportResult[] } | { error: string }> {
    // ... (previous logic)

      const relevantRecords = animalDoc.weightRecords
        .filter((record) =>
          record.date >= startDateRange && record.date <= endDateRange
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort by date for ADG calculation

      if (relevantRecords.length === 0) {
        newReportResults.push({
          animalId: animalId,
          recordedWeights: [],
          averageDailyGain: null,
        });
        continue;
      }

      let totalDailyGain = 0;
      let totalDays = 0;
      // FIX: Add type annotation for 'r'
      const recordedWeights = relevantRecords.map((r: WeightRecord) => ({
        date: r.date,
        weight: r.weight,
      }));

      for (let i = 1; i < relevantRecords.length; i++) {
        const prevRecord = relevantRecords[i - 1];
        const currentRecord = relevantRecords[i];

        const weightDiff = currentRecord.weight - prevRecord.weight;
        const timeDiffMs = currentRecord.date.getTime() - prevRecord.date.getTime();
        const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

        if (timeDiffDays > 0) {
          totalDailyGain += weightDiff;
          totalDays += timeDiffDays;
        }
      }

      const averageDailyGain = totalDays > 0 ? totalDailyGain / totalDays : null;

    // ... (rest of the generateReport method)
  }

  // ... (rest of the class)
}
```
