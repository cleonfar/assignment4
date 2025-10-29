---
timestamp: 'Mon Oct 27 2025 13:49:37 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251027_134937.f3084ac5.md]]'
content_id: 629e779125eaabcd9c46298cba64f793740daca81a78f00fe482558b3919a88c
---

# response:

Understood. To implement multi-tenancy and allow for user-scoped IDs, we will:

1. **Define `User` type**: Use `ID` for User identifiers.
2. **Update State Interfaces**:
   * `AnimalDoc`: Will have a system-generated `_id`, a `userId` field to link to the owner, and an `animalIdentifier` field to store the user-provided animal ID (which can be duplicated across users).
   * `ReportDoc`: Similarly, will have a system-generated `_id`, a `userId` field, and its `reportName` will now be unique per user.
   * `AnimalReportResult`: Will store the `animalIdentifier` (user-provided ID).
3. **Update All Action & Query Signatures**: Every public method will accept `user: User` as part of its input dictionary.
4. **Modify MongoDB Operations**: All database filters (`find`, `findOne`, `updateOne`, `deleteOne`) will include `userId` to ensure data isolation. When creating new documents, a `freshID()` will be used for `_id`, and `userId` and `animalIdentifier` (or `reportName`) will be explicitly set.
5. **Update Prompt for AI**: Ensure the AI prompt is updated to reflect the `Animal ID` distinction.

Here's the updated `GrowthTrackingConcept.ts` file incorporating these changes:

````typescript
// file: src/GrowthTracking/GrowthTrackingConcept.ts

import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "../../utils/types.ts"; // Assuming utils is one level up
import { freshID } from "../../utils/database.ts"; // Assuming utils is one level up

// Import for Google Gemini API
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

/**
 * @concept GrowthTracking [AnimalIdentifier]
 * @purpose track animal growth information, allowing users to manage their own animal data independently.
 * @principle a user records growth data like weight for individual animals;
 *            uses this data to generate reports to track performance and health;
 *            can give the generated reports to an AI for high level summary and suggests;
 *            each user's data is isolated and they can use their own naming conventions for animals.
 */
const PREFIX = "GrowthTracking" + ".";

// Generic types for this concept (these are user-facing IDs)
type User = ID; // The ID of the user owning the data
type AnimalIdentifier = ID; // The user's chosen identifier for an animal, unique per user
type ReportName = string; // The user's chosen name for a report, unique per user

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
 *   an `ID` of type `AnimalIdentifier` (user's ID for the animal)
 *   a `userId` of type `User` (owner of the animal data)
 *   a set of `WeightRecords`
 */
interface AnimalDoc {
  _id: ID; // MongoDB's unique document ID (system generated, not user-facing)
  userId: User;
  animalIdentifier: AnimalIdentifier; // User-provided identifier for the animal, unique per user
  weightRecords: WeightRecord[];
}

/**
 * Represents results for a single animal in a report.
 */
interface AnimalReportResult {
  animalId: AnimalIdentifier; // User's identifier for the animal
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
  insufficientData: string[]; // Category for animals with insufficient data
  insights: string; // A few short paragraphs (2-3) with deeper analysis
}

/**
 * a set of `Reports` with
 *   a `report name` of type `ReportName` (user's name for the report)
 *   a `userId` of type `User` (owner of the report)
 *   a `dateGenerated` of type `Date`
 *   a `target` of type `set of AnimalIdentifiers`
 *   a set of `results` of type `(key-value pairs of data)` (structured results per animal)
 *   an optional AI generatedSummary
 */
interface ReportDoc {
  _id: ID; // MongoDB's unique document ID (system generated, not user-facing)
  userId: User;
  reportName: ReportName; // User-provided name for the report, unique per user
  dateGenerated: Date;
  targetAnimals: AnimalIdentifier[]; // List of AnimalIdentifier (user-provided)
  results: AnimalReportResult[];
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
   * @action recordWeight (user: User, animal: AnimalIdentifier, date: Date, weight: Number, notes: String)
   * @requires animal exists (or will be created if first record for this user and animal)
   * @effects create a new weight record for this animal, associated with the given user.
   */
  async recordWeight(
    { user, animal, date, weight, notes }: {
      user: User;
      animal: AnimalIdentifier;
      date: Date;
      weight: number;
      notes: string;
    },
  ): Promise<Empty | { error: string }> {
    if (!user || !animal || !date || typeof weight !== "number") {
      return { error: "User ID, Animal ID, date, and weight are required." };
    }
    if (isNaN(date.getTime())) {
      return { error: "Invalid date provided." };
    }

    const newWeightRecord: WeightRecord = {
      date: date,
      weight: weight,
      notes: notes || "",
    };

    // Find the animal for this user or create it if it doesn't exist.
    // The `_id` of the document is a freshID, but we upsert based on `userId` and `animalIdentifier`.
    const result = await this.animals.updateOne(
      { userId: user, animalIdentifier: animal },
      {
        $push: { weightRecords: newWeightRecord },
        $setOnInsert: { _id: freshID(), userId: user, animalIdentifier: animal }, // Set _id and identifiers on insert
      },
      { upsert: true },
    );

    if (!result.acknowledged) {
      return { error: "Failed to record weight." };
    }

    return {};
  }

  /**
   * @action removeWeightRecord (user: User, animal: AnimalIdentifier, date: Date)
   * @requires there is a weight record for this animal and user on the given date
   * @effects remove the given weight record from the animal's set of weight records for the specific user.
   */
  async removeWeightRecord(
    { user, animal, date }: { user: User; animal: AnimalIdentifier; date: Date },
  ): Promise<Empty | { error: string }> {
    if (!user || !animal || !date) {
      return { error: "User ID, Animal ID, and date are required." };
    }
    if (isNaN(date.getTime())) {
      return { error: "Invalid date provided." };
    }

    const animalDoc = await this.animals.findOne({
      userId: user,
      animalIdentifier: animal,
    });
    if (!animalDoc) {
      return { error: `Animal with ID ${animal} for user ${user} not found.` };
    }

    const initialWeightRecordsCount = animalDoc.weightRecords.length;

    const result = await this.animals.updateOne(
      { userId: user, animalIdentifier: animal },
      { $pull: { weightRecords: { date: date } } },
    );

    if (result.modifiedCount === 0) {
      const updatedAnimalDoc = await this.animals.findOne({
        userId: user,
        animalIdentifier: animal,
      });
      if (updatedAnimalDoc && updatedAnimalDoc.weightRecords.length === initialWeightRecordsCount) {
        return {
          error:
            `No weight record found for animal ${animal} on date ${date.toISOString()} for user ${user}.`,
        };
      }
    }

    if (!result.acknowledged) {
      return { error: "Failed to remove weight record." };
    }

    return {};
  }

  /**
   * @action generateReport (user: User, animal: AnimalIdentifier, startDateRange: Date, endDateRange: Date, reportName: ReportName)
   * @requires target animal exists for the given user within the GrowthTracking concept's data
   * @effects If no report with this name exists for the user, then generate a new report for the given animal's growth performance
   *          within the specified date range. Otherwise, update the existing report by adding/updating the growth
   *          performance of this animal for the user. The report should include each recorded weight of the animal
   *          as well as its average daily rate of gain over each time period.
   */
  async generateReport(
    { user, animal, startDateRange, endDateRange, reportName }: {
      user: User;
      animal: AnimalIdentifier;
      startDateRange: Date;
      endDateRange: Date;
      reportName: ReportName;
    },
  ): Promise<{ report: ReportDoc } | { error: string }> {
    if (!user || !animal || !reportName || !startDateRange || !endDateRange) {
      return {
        error:
          "User ID, Animal ID, report name, start date, and end date are required.",
      };
    }
    if (isNaN(startDateRange.getTime()) || isNaN(endDateRange.getTime())) {
      return { error: "Invalid date range provided." };
    }
    if (startDateRange > endDateRange) {
      return { error: "Start date cannot be after end date." };
    }

    const animalDoc = await this.animals.findOne({
      userId: user,
      animalIdentifier: animal,
    });
    if (!animalDoc) {
      return {
        error:
          `Animal with ID ${animal} for user ${user} not found. Cannot generate report.`,
      };
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
    const existingReport = await this.reports.findOne({
      userId: user,
      reportName: reportName,
    });
    let finalReport: ReportDoc;

    if (existingReport) {
      // Update existing report
      const updatedTargetAnimals = Array.from(
        new Set([...existingReport.targetAnimals, animal]),
      );
      const updatedResultsMap = new Map<AnimalIdentifier, AnimalReportResult>();

      // Populate map with existing results, then overwrite/add current animal's result
      existingReport.results.forEach((res) =>
        updatedResultsMap.set(res.animalId, res)
      );
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
      finalReport = {
        ...existingReport,
        dateGenerated: now,
        targetAnimals: updatedTargetAnimals,
        results: Array.from(updatedResultsMap.values()),
      };
    } else {
      // Create new report
      finalReport = {
        _id: freshID(), // System-generated unique ID for the document
        userId: user,
        reportName: reportName, // User-provided report name, unique per user
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
   * @action renameReport (user: User, oldName: ReportName, newName: ReportName)
   * @requires oldName of report exists for the given user
   * @effects renames the specified report for the user.
   */
  async renameReport(
    { user, oldName, newName }: {
      user: User;
      oldName: ReportName;
      newName: ReportName;
    },
  ): Promise<{ newName: string } | { error: string }> {
    if (!user || !oldName || !newName) {
      return { error: "User ID, old report name, and new report name are required." };
    }
    if (oldName === newName) {
      return { error: "Old name and new name are the same." };
    }

    const existingReport = await this.reports.findOne({
      userId: user,
      reportName: oldName,
    });
    if (!existingReport) {
      return { error: `Report with name '${oldName}' for user ${user} not found.` };
    }

    const nameConflict = await this.reports.findOne({
      userId: user,
      reportName: newName,
    });
    if (nameConflict) {
      return { error: `A report with name '${newName}' already exists for user ${user}.` };
    }

    const result = await this.reports.updateOne(
      { _id: existingReport._id }, // Update by _id, but filter by user/name for finding
      { $set: { reportName: newName } },
    );

    if (!result.acknowledged || result.modifiedCount === 0) {
      return { error: "Failed to rename report." };
    }

    return { newName: newName };
  }

  /**
   * @action deleteReport (user: User, reportName: ReportName)
   * @requires report exists for the given user
   * @effects remove the report from the system for the specific user.
   */
  async deleteReport(
    { user, reportName }: { user: User; reportName: ReportName },
  ): Promise<Empty | { error: string }> {
    if (!user || !reportName) {
      return { error: "User ID and report name are required." };
    }

    const result = await this.reports.deleteOne({
      userId: user,
      reportName: reportName,
    });

    if (result.deletedCount === 0) {
      return { error: `Report with name '${reportName}' for user ${user} not found.` };
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
"insufficientData": [],  // NEW: Include animals with insufficient data
"insights": "A few short paragraphs (2-3) with deeper analysis: summarize the most important findings, discuss possible causes for low performance or concerning trends, and suggest practical management or intervention strategies for these cases. Do not focus on average/moderate performers, but do mention if the overall average performance of the group stands out as particularly good or bad."
}
Do not include any explanation, commentary, or text before or after the JSON. Only output valid JSON. If you cannot determine a category, return an empty array for that field. When populating the performer arrays (highPerformers, lowPerformers, concerningTrends, averagePerformers, potentialRecordErrors, insufficientData), use ONLY the Animal ID string. Only include animals in 'averagePerformers' if they are not in any other category. Every animal in the report must be classified into at least one of the following categories: highPerformers, lowPerformers, concerningTrends, averagePerformers, potentialRecordErrors, or insufficientData. No animal should be left unclassified.

Be highly suspicious of questionable or inconsistent records. Be liberal about classifying something as a potential record error: if there is any reasonable doubt or anything seems odd, include the animal in 'potentialRecordErrors' and mention the issue in 'insights'. Do not hesitate to flag records that seem unusual or inconsistent.

Only include animals in 'insufficientData' if their growth data within the reporting period is too sparse or singular to calculate a meaningful average daily gain, or if there's only one weight record for them in the period.

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
        !Array.isArray(parsedResponse.insufficientData) || // NEW: Validate insufficientData array
        !parsedResponse.insufficientData.every((item) => // NEW: Validate items in insufficientData
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
   * @action aiSummary (user: User, reportName: ReportName)
   * @requires report exists for the given user
   * @effects Forces the AI to generate a new summary of the report for the user,
   *          overwriting any existing summary, and saves it for future viewing.
   *          This action always generates a new summary.
   */
  async aiSummary(
    { user, reportName }: { user: User; reportName: ReportName },
  ): Promise<{ summary: string } | { error: string }> {
    if (!user || !reportName) {
      return { error: "User ID and report name are required." };
    }

    const report = await this.reports.findOne({
      userId: user,
      reportName: reportName,
    });
    if (!report) {
      return { error: `Report with name '${reportName}' for user ${user} not found.` };
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
   * @query _getAiSummary (user: User, reportName: ReportName)
   * @effects Returns an AI-generated summary of the report for the user. If a summary already exists,
   *          it is returned. Otherwise, a new summary is generated, saved, and then returned.
   */
  async _getAiSummary(
    { user, reportName }: { user: User; reportName: ReportName },
  ): Promise<{ summary: string } | { error: string }> {
    if (!user || !reportName) {
      return { error: "User ID and report name are required." };
    }

    const report = await this.reports.findOne({
      userId: user,
      reportName: reportName,
    });
    if (!report) {
      return { error: `Report with name '${reportName}' for user ${user} not found.` };
    }

    // If a summary already exists, return it immediately
    if (report.aiGeneratedSummary !== "") {
      return { summary: report.aiGeneratedSummary };
    }

    // Otherwise, generate a new summary using the action logic
    return await this.aiSummary({ user, reportName: reportName });
  }

  /**
   * @query _getAnimalWeights (user: User, animal: AnimalIdentifier)
   * @effects Returns all weight records for a given animal owned by the specified user.
   */
  async _getAnimalWeights(
    { user, animal }: { user: User; animal: AnimalIdentifier },
  ): Promise<{ weightRecords: WeightRecord[] } | { error: string }> {
    if (!user || !animal) {
      return { error: "User ID and Animal ID are required." };
    }
    const animalDoc = await this.animals.findOne({
      userId: user,
      animalIdentifier: animal,
    });
    if (!animalDoc) {
      return { error: `Animal with ID ${animal} for user ${user} not found.` };
    }
    return { weightRecords: animalDoc.weightRecords };
  }

  /**
   * @query _getReportByName (user: User, reportName: ReportName)
   * @effects Returns a report document by its name for the specified user.
   */
  async _getReportByName(
    { user, reportName }: { user: User; reportName: ReportName },
  ): Promise<{ report: ReportDoc } | { error: string }> {
    if (!user || !reportName) {
      return { error: "User ID and report name are required." };
    }
    const report = await this.reports.findOne({
      userId: user,
      reportName: reportName,
    });
    if (!report) {
      return { error: `Report with name '${reportName}' for user ${user} not found.` };
    }
    return { report: report };
  }

  /**
   * @query _getAllAnimalsWithWeightRecords (user: User)
   * @effects Returns a list of user-provided IDs (`AnimalIdentifier`) for all animals
   *          that have at least one weight record and belong to the specified user.
   *          If no animals have weight records for that user, returns an empty array.
   */
  async _getAllAnimalsWithWeightRecords(
    { user }: { user: User },
  ): Promise<{ animals: AnimalIdentifier[] }> {
    if (!user) {
      return { error: "User ID is required." } as { animals: AnimalIdentifier[] }; // Return error in expected format
    }
    // Find all animal documents for the given user where the 'weightRecords' array is not empty
    const animalDocs = await this.animals.find({
      userId: user,
      weightRecords: { $exists: true, $not: { $size: 0 } },
    }).project({ animalIdentifier: 1, _id: 0 }).toArray(); // Project only animalIdentifier

    // Map the results to an array of Animal Identifiers
    const animals = animalDocs.map((doc) => doc.animalIdentifier);

    return { animals: animals };
  }
}
````
