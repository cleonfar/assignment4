---
timestamp: 'Mon Nov 03 2025 01:06:04 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_010604.ce4ebf5f.md]]'
content_id: 51f1eae373846c83f0e6cc340fac1db9f7df8977cddb8fc8204fb15bc51dddb0
---

# response:

You're right, adding a `deleteAnimal` action is a crucial piece of functionality for managing animal records. It also introduces an interesting cascading effect on reports, which we need to handle carefully to maintain data consistency.

Here's the `deleteAnimal` action and the updated `GrowthTrackingConcept.ts` file:

````typescript
import { Collection, Db, ObjectId } from "npm:mongodb";
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
type Animal = ID; // User-facing animal identifier
type ReportID = ID; // Internal report _id
type UserId = ID; // Owner/user identifier

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
 *   a `userId` to link to the owner
 */
interface AnimalDoc {
  _id: ID; // System-generated unique ID (Mongo _id)
  ownerId: UserId; // Owner of the animal record (scoping key)
  animalId: Animal; // User-facing animal identifier, unique per owner
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
  insufficientData: string[]; // Category for animals with insufficient data
  insights: string; // A few short paragraphs (2-3) with deeper analysis
}

/**
 * a set of `Reports` with
 *   a `report name` of type `String`
 *   a `dateGenerated` of type `Date`
 *   a `target` of type `set of IDs` (animals)
 *   a set of `results` of type `(key-value pairs of data)` (structured results per animal)
 *   an optional AI generatedSummary
 *   a `userId` to link to the owner
 */
interface ReportDoc {
  _id: ReportID; // Internal ID for MongoDB (system-generated)
  reportName: string; // User-facing report name, unique per owner
  ownerId: UserId; // Associate report with a user
  dateGenerated: Date;
  targetAnimals: Animal[]; // A set of animals included in this report (user-facing IDs)
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

  // Normalize incoming dates (Date or ISO string) into Date objects
  private _toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  /**
   * @action recordWeight
   * @requires user, animal, date, and weight are provided
   * @effects Creates a new weight record for this animal, or updates an existing animal with the new record.
   *          If the animal does not exist for the user, a new animal document is created.
   */
  async recordWeight(
    { user, animal, date, weight, notes }: {
      user: UserId;
      animal: Animal;
      date: Date | string;
      weight: number;
      notes: string;
    },
  ): Promise<Empty | { error: string }> {
    if (!user || !animal || !date || typeof weight !== "number") {
      return { error: "User ID, Animal ID, date, and weight are required." };
    }
    const parsedDate = this._toDate(date);
    if (isNaN(parsedDate.getTime())) {
      return { error: "Invalid date provided." };
    }

    const newWeightRecord: WeightRecord = {
      date: parsedDate,
      weight: weight,
      notes: notes || "", // Ensure notes is an empty string if not provided
    };

    // Upsert animal document by owner+animalId; generate system _id on insert
    const result = await this.animals.updateOne(
      { ownerId: user, animalId: animal },
      {
        $push: { weightRecords: newWeightRecord },
        $setOnInsert: { _id: freshID(), ownerId: user, animalId: animal },
      },
      { upsert: true },
    );

    if (!result.acknowledged) {
      return { error: "Failed to record weight." };
    }

    return {};
  }

  /**
   * @action removeWeightRecord
   * @requires an animal with the given `animal` ID exists for `user`, and a weight record for that animal exists on `date`
   * @effects Removes the specified weight record from the animal's set of weight records.
   */
  async removeWeightRecord(
    { user, animal, date }: {
      user: UserId;
      animal: Animal;
      date: Date | string;
    },
  ): Promise<Empty | { error: string }> {
    if (!user || !animal || !date) {
      return { error: "User ID, Animal ID, and date are required." };
    }
    const parsedDate = this._toDate(date);
    if (isNaN(parsedDate.getTime())) {
      return { error: "Invalid date provided." };
    }

    const animalDoc = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!animalDoc) {
      return { error: `Animal with ID ${animal} not found for user ${user}.` };
    }

    const initialWeightRecordsCount = animalDoc.weightRecords.length;

    const result = await this.animals.updateOne(
      { ownerId: user, animalId: animal },
      { $pull: { weightRecords: { date: parsedDate } } },
    );

    if (result.modifiedCount === 0) {
      const updatedAnimalDoc = await this.animals.findOne({
        ownerId: user,
        animalId: animal,
      });
      if (
        updatedAnimalDoc &&
        updatedAnimalDoc.weightRecords.length === initialWeightRecordsCount
      ) {
        return {
          error:
            `No weight record found for animal ${animal} on date ${parsedDate.toISOString()} for user ${user}.`,
        };
      }
    }

    if (!result.acknowledged) {
      return { error: "Failed to remove weight record." };
    }

    return {};
  }

  /**
   * @action deleteAnimal
   * @requires an animal with the given `animal` ID exists and is owned by `user`
   * @effects Removes the animal document and all its associated weight records for the given user.
   *          Also, for all reports owned by `user`, if the deleted animal was included:
   *          removes the animal from the report's `targetAnimals` list and its corresponding entry from `results`.
   *          If, after this update, a report's `targetAnimals` or `results` array becomes empty, that report is also deleted.
   */
  async deleteAnimal(
    { user, animal }: { user: UserId; animal: Animal },
  ): Promise<Empty | { error: string }> {
    if (!user || !animal) {
      return { error: "User ID and Animal ID are required." };
    }

    // 1. Verify the animal exists for the user
    const animalDoc = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!animalDoc) {
      return { error: `Animal with ID '${animal}' not found for user ${user}.` };
    }

    // 2. Delete the animal document
    const deleteAnimalResult = await this.animals.deleteOne({
      _id: animalDoc._id,
    });
    if (deleteAnimalResult.deletedCount === 0) {
      return { error: "Failed to delete animal." };
    }

    // 3. Update all reports that referenced this animal for this user
    // Remove the animal from targetAnimals and its result from results array
    await this.reports.updateMany(
      { ownerId: user, targetAnimals: animal }, // Find reports by owner that include this animal
      {
        $pull: {
          targetAnimals: animal, // Remove from the list of target animals
          results: { animalId: animal }, // Remove the specific AnimalReportResult
        },
      },
    );

    // 4. Delete any reports that became empty after removing the animal
    const deleteEmptyReportsResult = await this.reports.deleteMany({
      ownerId: user,
      $or: [
        { targetAnimals: { $size: 0 } }, // If targetAnimals array is empty
        { results: { $size: 0 } }, // If results array is empty
      ],
    });

    if (!deleteAnimalResult.acknowledged || !deleteEmptyReportsResult.acknowledged) {
      return { error: "Failed to complete animal deletion and report cleanup." };
    }

    return {};
  }

  /**
   * @action generateReport
   * @requires target animal exists within the GrowthTracking concept's data for the given user
   * @effects If no report with this name exists then generate a new report for the given animal's growth performance
   *          within the specified date range. Otherwise, update the existing report by adding/updating the growth
   *          performance of this animal. The report should include each recorded weight of the animal
   *          as well as its average daily rate of gain over each time period.
   */
  async generateReport(
    { user, animal, startDateRange, endDateRange, reportName }: {
      user: UserId;
      animal: Animal;
      startDateRange: Date | string;
      endDateRange: Date | string;
      reportName: string;
    },
  ): Promise<{ report: ReportDoc } | { error: string }> {
    if (!user || !animal || !reportName || !startDateRange || !endDateRange) {
      return {
        error:
          "User ID, Animal ID, report name, start date, and end date are required.",
      };
    }
    const start = this._toDate(startDateRange);
    const end = this._toDate(endDateRange);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { error: "Invalid date range provided." };
    }
    if (start > end) {
      return { error: "Start date cannot be after end date." };
    }

    const animalDoc = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!animalDoc) {
      return {
        error:
          `Animal with ID ${animal} not found for user ${user}. Cannot generate report.`,
      };
    }

    const relevantRecords = animalDoc.weightRecords
      .filter((record) => record.date >= start && record.date <= end)
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
        const timeDiffMs = currentRecord.date.getTime() -
          prevRecord.date.getTime();
        const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

        if (timeDiffDays > 0) {
          totalDailyGain += weightDiff;
          totalDays += timeDiffDays;
        }
      }

      const averageDailyGain = totalDays > 0
        ? totalDailyGain / totalDays
        : null;

      currentAnimalReportResult = {
        animalId: animal,
        recordedWeights: recordedWeights,
        averageDailyGain: averageDailyGain,
      };
    }

    const now = new Date();
    // Find report by name AND owner
    const existingReport = await this.reports.findOne({
      reportName: reportName,
      ownerId: user,
    });
    let finalReport: ReportDoc;

    if (existingReport) {
      // Update existing report for THIS user
      const updatedTargetAnimals = Array.from(
        new Set([...existingReport.targetAnimals, animal]),
      );
      const updatedResultsMap = new Map<Animal, AnimalReportResult>();

      // Populate map with existing results, then overwrite/add current animal's result
      existingReport.results.forEach((res) =>
        updatedResultsMap.set(res.animalId, res)
      );
      updatedResultsMap.set(animal, currentAnimalReportResult);

      const updateResult = await this.reports.updateOne(
        { _id: existingReport._id, ownerId: user },
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
      // Create new report for THIS user
      const newReportId = freshID();
      finalReport = {
        _id: newReportId,
        reportName: reportName,
        ownerId: user,
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
   * @requires an existing report with `oldName` owned by `user`
   * @effects Renames the specified report for the given user, provided `newName` does not already exist for that user.
   */
  async renameReport(
    { user, oldName, newName }: {
      user: UserId;
      oldName: string;
      newName: string;
    },
  ): Promise<{ newName: string } | { error: string }> {
    if (!user || !oldName || !newName) {
      return {
        error: "User ID, old report name, and new report name are required.",
      };
    }
    if (oldName === newName) {
      return { error: "Old name and new name are the same." };
    }

    const existingReport = await this.reports.findOne({
      reportName: oldName,
      ownerId: user,
    });
    if (!existingReport) {
      return {
        error: `Report with name '${oldName}' not found for user ${user}.`,
      };
    }

    const nameConflict = await this.reports.findOne({
      reportName: newName,
      ownerId: user,
    });
    if (nameConflict) {
      return {
        error:
          `A report with name '${newName}' already exists for user ${user}.`,
      };
    }

    const result = await this.reports.updateOne(
      { _id: existingReport._id, ownerId: user },
      { $set: { reportName: newName } },
    );

    if (!result.acknowledged || result.modifiedCount === 0) {
      return { error: "Failed to rename report." };
    }

    return { newName: newName };
  }

  /**
   * @action deleteReport
   * @requires an existing report with `reportName` owned by `user`
   * @effects Removes the report from the system for the given user.
   */
  async deleteReport(
    { user, reportName }: { user: UserId; reportName: string },
  ): Promise<Empty | { error: string }> {
    if (!user || !reportName) {
      return { error: "User ID and report name are required." };
    }

    const result = await this.reports.deleteOne({
      reportName: reportName,
      ownerId: user,
    });

    if (result.deletedCount === 0) {
      return {
        error: `Report with name '${reportName}' not found for user ${user}.`,
      };
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
      const weights = result.recordedWeights.map((w) =>
        `        - Date: ${
          w.date.toISOString().split("T")[0]
        }, Weight: ${w.weight}`
      ).join("\n");
      const adg = result.averageDailyGain !== null
        ? result.averageDailyGain.toFixed(2)
        : "N/A";
      return `
  Animal ID: ${result.animalId}
    Recorded Weights in Period:
${weights || "      (No weight records in this period)"}
    Calculated Average Daily Gain (ADG): ${adg} units/day`;
    };

    const fullPrompt =
      `You are an expert livestock analyst. Given the following report, respond ONLY with valid JSON in this exact format:
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
        !Array.isArray(parsedResponse.insufficientData) || // Validate insufficientData array
        !parsedResponse.insufficientData.every((item) =>
          // Validate items in insufficientData
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
   * @requires an existing report with `reportName` owned by `user`
   * @effects Forces the AI to generate a new summary of the report,
   *          overwriting any existing summary, and saves it for future viewing.
   *          This action always generates a new summary.
   */
  async aiSummary(
    { user, reportName }: { user: UserId; reportName: string },
  ): Promise<{ summary: string } | { error: string }> {
    if (!user || !reportName) {
      return { error: "User ID and Report name are required." };
    }

    const report = await this.reports.findOne({
      reportName: reportName,
      ownerId: user,
    });
    if (!report) {
      return {
        error: `Report with name '${reportName}' not found for user ${user}.`,
      };
    }

    try {
      const generatedSummary = await this._callLLMAndGetSummary(report);

      await this.reports.updateOne(
        { _id: report._id, ownerId: user },
        { $set: { aiGeneratedSummary: generatedSummary } },
      );

      return { summary: generatedSummary };
    } catch (llmError: unknown) {
      console.error("Error generating AI summary:", llmError);
      return {
        error: `Failed to generate AI summary: ${
          (llmError && typeof llmError === "object" && "message" in llmError)
            ? String((llmError as { message?: unknown }).message)
            : "Unknown LLM error"
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
    { user, reportName }: { user: UserId; reportName: string },
  ): Promise<{ summary: string } | { error: string }> {
    if (!user || !reportName) {
      return { error: "User ID and Report name are required." };
    }

    const report = await this.reports.findOne({
      reportName: reportName,
      ownerId: user,
    });
    if (!report) {
      return {
        error: `Report with name '${reportName}' not found for user ${user}.`,
      };
    }

    // If a summary already exists, return it immediately
    if (report.aiGeneratedSummary !== "") {
      return { summary: report.aiGeneratedSummary };
    }

    // Otherwise, generate a new summary using the action logic
    return await this.aiSummary({ user, reportName: reportName }); // Pass user to aiSummary action
  }

  /**
   * @query _getAnimalWeights
   * @effects Returns all weight records for a given animal owned by the user.
   */
  async _getAnimalWeights(
    { user, animal }: { user: UserId; animal: Animal },
  ): Promise<{ weightRecords: WeightRecord[] } | { error: string }> {
    if (!user || !animal) {
      return { error: "User ID and Animal ID are required." };
    }
    const animalDoc = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!animalDoc) {
      return { error: `Animal with ID ${animal} not found for user ${user}.` };
    }
    return { weightRecords: animalDoc.weightRecords };
  }

  /**
   * @query _getReportByName
   * @effects Returns a report document by its name, owned by the user.
   */
  async _getReportByName(
    { user, reportName }: { user: UserId; reportName: string },
  ): Promise<{ report: ReportDoc } | { error: string }> {
    if (!user || !reportName) {
      return { error: "User ID and Report name are required." };
    }
    const report = await this.reports.findOne({
      reportName: reportName,
      ownerId: user,
    });
    if (!report) {
      return {
        error: `Report with name '${reportName}' not found for user ${user}.`,
      };
    }
    return { report: report };
  }

  /**
   * @query _listReports
   * @effects Returns all reports belonging to the given user.
   */
  async _listReports(
    { user }: { user: UserId },
  ): Promise<{ reports: ReportDoc[] } | { error: string }> {
    if (!user) {
      return { error: "User ID is required." };
    }

    const reports = await this.reports.find({ ownerId: user }).toArray();
    return { reports };
  }

  /**
   * @query _getAllAnimalsWithWeightRecords
   * @effects Returns a list of IDs for all animals that have at least one weight record for a given user.
   *          If no animals have weight records, returns an empty array.
   */
  async _getAllAnimalsWithWeightRecords(
    { user }: { user: UserId },
  ): Promise<{ animals: Animal[] } | { error: string }> {
    if (!user) {
      return { error: "User ID is required." };
    }
    // Find all animal documents for THIS user where the 'weightRecords' array is not empty
    const animalDocs = await this.animals.find({
      ownerId: user,
      weightRecords: { $exists: true, $not: { $size: 0 } },
    }).project({ animalId: 1 }).toArray();

    // Map the results to an array of user-facing Animal IDs
    const animals = animalDocs.map((doc) =>
      (doc as unknown as { animalId: Animal }).animalId
    );

    return { animals: animals };
  }
}
````
