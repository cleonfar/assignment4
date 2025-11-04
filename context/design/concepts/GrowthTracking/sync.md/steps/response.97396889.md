---
timestamp: 'Sun Nov 02 2025 19:21:57 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_192157.74adff65.md]]'
content_id: 97396889e4f3d9d34379e1422f3c433f9b73d2ab20e0f068db3af2e22064e837
---

# response:

You're absolutely right to want to clarify the distinction between the animal ID and its associated data for the AI! Clarity in prompts is crucial for getting the desired output from large language models.

I've updated the `_callLLMAndGetSummary` method in `GrowthTrackingConcept.ts` with the following changes:

1. **Enhanced `formatAnimalReportResult`**:
   * Removed the `index` prefix for each animal entry, as the `Animal ID` itself serves as the identifier.
   * Added more distinct headings and indentation to visually separate the `Animal ID`, `Recorded Weights`, and `Average Daily Gain (ADG)` for each animal in the report entry.
   * Explicitly states "No weight records in this period" when an animal has no relevant records within the date range, making it clearer to the AI.

2. **Explicit Instruction in `fullPrompt`**:
   * Added a new paragraph just before the `Report Entries` section that explicitly describes the structure of each animal's data within the report, emphasizing the distinct "Animal ID" and its associated "Recorded Weights in Period" and "Calculated Average Daily Gain (ADG)".

This should significantly improve the AI's understanding of how individual animal data is presented and differentiate between the animal's identity and its growth records.

Here's the updated `GrowthTrackingConcept.ts` file:

````typescript
// file: src/GrowthTracking/GrowthTrackingConcept.ts

import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "../../utils/types.ts"; // Assuming utils is one level up
import { freshID } from "../../utils/database.ts"; // Assuming utils is one level up

// Import for Google Gemini API
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

/**
 * @concept GrowthTracking
 * @purpose track animal growth information
 * @principle a user records growth data like weight for individual animals;
 *            uses this data to generate reports to track performance and health;
 *            can give the generated reports to an AI for high level summary and suggests;
 */
const PREFIX = "GrowthTracking" + ".";

// Generic types for this concept
type Animal = ID;
type ReportID = ID; // Using ID for reports as well, though `name` is also a unique identifier for reports

/**
 * a set of `WeightRecords` with
 *   a `date` of type `Date`
 *   a `weight` of type `Number`
 *   an optional `notes` of type `String`
 */
interface WeightRecord {
  date: Date;
  weight: number;
  notes: string; // Optional string fields have an empty string instead of null or undefined
}

/**
 * a set of `animals` with
 *   an `ID` of type `ID`
 *   a set of `WeightRecords`
 */
interface AnimalDoc {
  _id: Animal;
  weightRecords: WeightRecord[];
}

/**
 * Represents results for a single animal in a report.
 */
interface AnimalReportResult {
  animalId: Animal;
  recordedWeights: { date: Date; weight: number }[];
  averageDailyGain: number | null; // e.g., kg/day
}

/**
 * Define the expected output structure from the LLM
 */
interface LLMSummaryOutput {
  highPerformers: string[];
  lowPerformers: string[];
  concerningTrends: string[];
  averagePerformers: string[];
  potentialRecordErrors: string[];
  insights: string; // A few short paragraphs (2-3) with deeper analysis
}

/**
 * a set of `Reports` with
 *   a `report name` of type `String`
 *   a `dateGenerated` of type `Date`
 *   a `target` of type `set of IDs` (animals)
 *   a set of `results` of type `(key-value pairs of data)` (structured results per animal)
 *   an optional AI generatedSummary
 */
interface ReportDoc {
  _id: ReportID; // Internal ID for MongoDB
  reportName: string; // Used as the primary identifier for reports in actions
  dateGenerated: Date;
  targetAnimals: Animal[]; // A set of animals included in this report
  results: AnimalReportResult[]; // Structured results
  aiGeneratedSummary: string; // Optional string fields have an empty string (stores stringified JSON from LLM)
}

export default class GrowthTrackingConcept {
  private animals: Collection<AnimalDoc>;
  private reports: Collection<ReportDoc>;

  constructor(private readonly db: Db) {
    this.animals = this.db.collection(PREFIX + "animals");
    this.reports = this.db.collection(PREFIX + "reports");
  }

  /**
   * @action recordWeight
   * @requires animal exists (or will be created if first record)
   * @effects create a new weight record for this animal
   */
  async recordWeight(
    { animal, date, weight, notes }: {
      animal: Animal;
      date: Date;
      weight: number;
      notes: string;
    },
  ): Promise<Empty | { error: string }> {
    if (!animal || !date || typeof weight !== "number") {
      return { error: "Animal ID, date, and weight are required." };
    }
    if (isNaN(date.getTime())) {
      return { error: "Invalid date provided." };
    }

    const newWeightRecord: WeightRecord = {
      date: date,
      weight: weight,
      notes: notes || "", // Ensure notes is an empty string if not provided
    };

    const result = await this.animals.updateOne(
      { _id: animal },
      { $push: { weightRecords: newWeightRecord } },
      { upsert: true },
    );

    if (!result.acknowledged) {
      return { error: "Failed to record weight." };
    }

    return {};
  }

  /**
   * @action removeWeightRecord
   * @requires there is a weight record for this animal on the given date
   * @effects remove the given weight record from the animal's set of weight records
   */
  async removeWeightRecord(
    { animal, date }: { animal: Animal; date: Date },
  ): Promise<Empty | { error: string }> {
    if (!animal || !date) {
      return { error: "Animal ID and date are required." };
    }
    if (isNaN(date.getTime())) {
      return { error: "Invalid date provided." };
    }

    const animalDoc = await this.animals.findOne({ _id: animal });
    if (!animalDoc) {
      return { error: `Animal with ID ${animal} not found.` };
    }

    const initialWeightRecordsCount = animalDoc.weightRecords.length;

    const result = await this.animals.updateOne(
      { _id: animal },
      { $pull: { weightRecords: { date: date } } },
    );

    if (result.modifiedCount === 0) {
      const updatedAnimalDoc = await this.animals.findOne({ _id: animal });
      if (updatedAnimalDoc && updatedAnimalDoc.weightRecords.length === initialWeightRecordsCount) {
        return { error: `No weight record found for animal ${animal} on date ${date.toISOString()}.` };
      }
    }

    if (!result.acknowledged) {
      return { error: "Failed to remove weight record." };
    }

    return {};
  }

  /**
   * @action generateReport
   * @requires target animal exists within the GrowthTracking concept's data
   * @effects If no report with this name exists then generate a new report for the given animal's growth performance
   *          within the specified date range. Otherwise, update the existing report by adding/updating the growth
   *          performance of this animal. The report should include each recorded weight of the animal
   *          as well as its average daily rate of gain over each time period.
   */
  async generateReport(
    { animal, startDateRange, endDateRange, reportName }: {
      animal: Animal;
      startDateRange: Date;
      endDateRange: Date;
      reportName: string;
    },
  ): Promise<{ report: ReportDoc } | { error: string }> {
    if (!animal || !reportName || !startDateRange || !endDateRange) {
      return { error: "Animal ID, report name, start date, and end date are required." };
    }
    if (isNaN(startDateRange.getTime()) || isNaN(endDateRange.getTime())) {
      return { error: "Invalid date range provided." };
    }
    if (startDateRange > endDateRange) {
      return { error: "Start date cannot be after end date." };
    }

    const animalDoc = await this.animals.findOne({ _id: animal });
    if (!animalDoc) {
      return { error: `Animal with ID ${animal} not found. Cannot generate report.` };
    }

    const relevantRecords = animalDoc.weightRecords
      .filter((record) =>
        record.date >= startDateRange && record.date <= endDateRange
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort by date for ADG calculation

    let currentAnimalReportResult: AnimalReportResult;

    if (relevantRecords.length === 0) {
      currentAnimalReportResult = {
        animalId: animal,
        recordedWeights: [],
        averageDailyGain: null,
      };
    } else {
      let totalDailyGain = 0;
      let totalDays = 0;
      const recordedWeights = relevantRecords.map((r) => ({
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

      currentAnimalReportResult = {
        animalId: animal,
        recordedWeights: recordedWeights,
        averageDailyGain: averageDailyGain,
      };
    }

    const now = new Date();
    const existingReport = await this.reports.findOne({ reportName: reportName });
    let finalReport: ReportDoc;

    if (existingReport) {
      // Update existing report
      const updatedTargetAnimals = Array.from(new Set([...existingReport.targetAnimals, animal]));
      const updatedResultsMap = new Map<Animal, AnimalReportResult>();

      // Populate map with existing results, then overwrite/add current animal's result
      existingReport.results.forEach(res => updatedResultsMap.set(res.animalId, res));
      updatedResultsMap.set(animal, currentAnimalReportResult);

      const updateResult = await this.reports.updateOne(
        { _id: existingReport._id },
        {
          $set: {
            dateGenerated: now,
            targetAnimals: updatedTargetAnimals,
            results: Array.from(updatedResultsMap.values()),
          },
        },
      );
      if (!updateResult.acknowledged) {
        return { error: "Failed to update existing report." };
      }
      finalReport = { ...existingReport, dateGenerated: now, targetAnimals: updatedTargetAnimals, results: Array.from(updatedResultsMap.values()) };
    } else {
      // Create new report
      const newReportId = freshID();
      finalReport = {
        _id: newReportId,
        reportName: reportName,
        dateGenerated: now,
        targetAnimals: [animal],
        results: [currentAnimalReportResult],
        aiGeneratedSummary: "", // Initialize as empty string
      };
      const insertResult = await this.reports.insertOne(finalReport);
      if (!insertResult.acknowledged) {
        return { error: "Failed to create new report." };
      }
    }

    return { report: finalReport };
  }

  /**
   * @action renameReport
   * @requires oldName of report exists
   * @effects renames the specified report
   */
  async renameReport(
    { oldName, newName }: { oldName: string; newName: string },
  ): Promise<{ newName: string } | { error: string }> {
    if (!oldName || !newName) {
      return { error: "Old report name and new report name are required." };
    }
    if (oldName === newName) {
      return { error: "Old name and new name are the same." };
    }

    const existingReport = await this.reports.findOne({ reportName: oldName });
    if (!existingReport) {
      return { error: `Report with name '${oldName}' not found.` };
    }

    const nameConflict = await this.reports.findOne({ reportName: newName });
    if (nameConflict) {
      return { error: `A report with name '${newName}' already exists.` };
    }

    const result = await this.reports.updateOne(
      { _id: existingReport._id },
      { $set: { reportName: newName } },
    );

    if (!result.acknowledged || result.modifiedCount === 0) {
      return { error: "Failed to rename report." };
    }

    return { newName: newName };
  }

  /**
   * @action deleteReport
   * @requires report exists
   * @effects remove the report from the system
   */
  async deleteReport(
    { reportName }: { reportName: string },
  ): Promise<Empty | { error: string }> {
    if (!reportName) {
      return { error: "Report name is required." };
    }

    const result = await this.reports.deleteOne({ reportName: reportName });

    if (result.deletedCount === 0) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    if (!result.acknowledged) {
      return { error: "Failed to delete report." };
    }

    return {};
  }

  /**
   * @private
   * Private helper to encapsulate LLM interaction logic.
   * Handles prompt construction, API call, and response parsing/validation.
   * @param {ReportDoc} report - The report object to be summarized.
   * @returns {Promise<string>} The stringified, validated JSON summary.
   * @throws {Error} If GEMINI_API_KEY is not set, or if LLM response is invalid.
   */
  private async _callLLMAndGetSummary(report: ReportDoc): Promise<string> {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set in environment variables.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); // Using a current flash model

    // Helper to format AnimalReportResult for the prompt
    const formatAnimalReportResult = (result: AnimalReportResult) => {
      const weights = result.recordedWeights.map(w => `        - Date: ${w.date.toISOString().split('T')[0]}, Weight: ${w.weight}`).join('\n');
      const adg = result.averageDailyGain !== null ? result.averageDailyGain.toFixed(2) : "N/A";
      return `
  Animal ID: ${result.animalId}
    Recorded Weights in Period:
${weights || '      (No weight records in this period)'}
    Calculated Average Daily Gain (ADG): ${adg} units/day`;
    };

    const fullPrompt = `You are an expert livestock analyst. Given the following report, respond ONLY with valid JSON in this exact format:
{
"highPerformers": [],
"lowPerformers": [],
"concerningTrends": [],
"averagePerformers": [],
"potentialRecordErrors": [],
"insights": "A few short paragraphs (2-3) with deeper analysis: summarize the most important findings, discuss possible causes for low performance or concerning trends, and suggest practical management or intervention strategies for these cases. Do not focus on average/moderate performers, but do mention if the overall average performance of the group stands out as particularly good or bad."
}
Do not include any explanation, commentary, or text before or after the JSON. Only output valid JSON. If you cannot determine a category, return an empty array for that field. Only include animals in 'averagePerformers' if they are not in any other category. Every animal in the report must be classified into at least one of the following categories: highPerformers, lowPerformers, concerningTrends, averagePerformers, or potentialRecordErrors. No animal should be left unclassified.

Be highly suspicious of questionable or inconsistent records. Be liberal about classifying something as a potential record error: if there is any reasonable doubt or anything seems odd, include the animal in 'potentialRecordErrors' and mention the issue in 'insights'. Do not hesitate to flag records that seem unusual or inconsistent.

Here are some examples of suspicious or potentially erroneous records:

* Negative or impossible values (e.g., negative weights, negative gains, or negative counts)
* Impossibly high or low numbers for the species or age (e.g., a lamb weighing 500kg, or a newborn with an adult weight)
* Obvious typos (such as an extra zero, misplaced decimal, or swapped digits)
* Duplicate or missing records
* Any other data that seems inconsistent, out of range, or highly unlikely
Mark records as a potential record error if they may include a typo or if the values are impossibly good or bad for the species or age. Err on the side of caution and flag anything that could possibly be a record error.

Here is the report data:
Report Name: ${report.reportName}
Generated Date: ${report.dateGenerated.toISOString()}
Target Animals: ${report.targetAnimals.join(", ")}

Each of the following 'Report Entries' provides detailed growth data for a single animal. Pay close attention to the structure, where 'Animal ID' identifies the animal, followed by its specific 'Recorded Weights in Period' and 'Calculated Average Daily Gain (ADG)' for the report period.
Report Entries:
${report.results.map((r) => formatAnimalReportResult(r)).join("\n")}
`;

    const result = await model.generateContent(fullPrompt);
    let text = result.response.text(); // Get raw text

    // Pre-processing for LLM output: remove markdown code block delimiters
    text = text.trim();
    if (text.startsWith("```json")) {
      text = text.substring("```json".length).trimStart();
    }
    if (text.endsWith("```")) {
      text = text.substring(0, text.length - "```".length).trimEnd();
    }

    let parsedResponse: LLMSummaryOutput;
    try {
      parsedResponse = JSON.parse(text);
      // Basic validation of the parsed structure and types
      if (
        !Array.isArray(parsedResponse.highPerformers) ||
        !parsedResponse.highPerformers.every((item) =>
          typeof item === "string"
        ) ||
        !Array.isArray(parsedResponse.lowPerformers) ||
        !parsedResponse.lowPerformers.every((item) =>
          typeof item === "string"
        ) ||
        !Array.isArray(parsedResponse.concerningTrends) ||
        !parsedResponse.concerningTrends.every((item) =>
          typeof item === "string"
        ) ||
        !Array.isArray(parsedResponse.averagePerformers) ||
        !parsedResponse.averagePerformers.every((item) =>
          typeof item === "string"
        ) ||
        !Array.isArray(parsedResponse.potentialRecordErrors) ||
        !parsedResponse.potentialRecordErrors.every((item) =>
          typeof item === "string"
        ) ||
        typeof parsedResponse.insights !== "string"
      ) {
        throw new Error(
          "Parsed JSON does not match expected structure or types.",
        );
      }
    } catch (parseError) {
      console.error(
        "LLM response was not valid JSON or did not match structure:",
        text,
        parseError,
      );
      throw new Error(`Invalid JSON response from LLM. Raw response: ${text}`);
    }

    return text; // Return the stringified, validated JSON
  }

  /**
   * @action aiSummary
   * @requires report exists
   * @effects Forces the AI to generate a new summary of the report,
   *          overwriting any existing summary, and saves it for future viewing.
   *          This action always generates a new summary.
   */
  async aiSummary(
    { reportName }: { reportName: string },
  ): Promise<{ summary: string } | { error: string }> {
    if (!reportName) {
      return { error: "Report name is required." };
    }

    const report = await this.reports.findOne({ reportName: reportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }

    try {
      const generatedSummary = await this._callLLMAndGetSummary(report);

      await this.reports.updateOne(
        { _id: report._id },
        { $set: { aiGeneratedSummary: generatedSummary } },
      );

      return { summary: generatedSummary };
    } catch (llmError: any) {
      console.error("Error generating AI summary:", llmError);
      return {
        error: `Failed to generate AI summary: ${
          llmError.message || "Unknown LLM error"
        }`,
      };
    }
  }

  /**
   * @query _getAiSummary
   * @effects Returns an AI-generated summary of the report. If a summary already exists,
   *          it is returned. Otherwise, a new summary is generated, saved, and then returned.
   */
  async _getAiSummary(
    { reportName }: { reportName: string },
  ): Promise<{ summary: string } | { error: string }> {
    if (!reportName) {
      return { error: "Report name is required." };
    }

    const report = await this.reports.findOne({ reportName: reportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }

    // If a summary already exists, return it immediately
    if (report.aiGeneratedSummary !== "") {
      return { summary: report.aiGeneratedSummary };
    }

    // Otherwise, generate a new summary using the action logic
    return await this.aiSummary({ reportName: reportName });
  }

  /**
   * @query _getAnimalWeights
   * @effects Returns all weight records for a given animal.
   */
  async _getAnimalWeights(
    { animal }: { animal: Animal },
  ): Promise<{ weightRecords: WeightRecord[] } | { error: string }> {
    if (!animal) {
      return { error: "Animal ID is required." };
    }
    const animalDoc = await this.animals.findOne({ _id: animal });
    if (!animalDoc) {
      return { error: `Animal with ID ${animal} not found.` };
    }
    return { weightRecords: animalDoc.weightRecords };
  }

  /**
   * @query _getReportByName
   * @effects Returns a report document by its name.
   */
  async _getReportByName(
    { reportName }: { reportName: string },
  ): Promise<{ report: ReportDoc } | { error: string }> {
    if (!reportName) {
      return { error: "Report name is required." };
    }
    const report = await this.reports.findOne({ reportName: reportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    return { report: report };
  }
}
````
