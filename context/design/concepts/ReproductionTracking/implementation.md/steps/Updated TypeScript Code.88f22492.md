---
timestamp: 'Thu Oct 16 2025 01:57:27 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_015727.f7710e9e.md]]'
content_id: 88f22492b80ce6ac302dc310b5df22920049852d9e232720ea2014ddf023c318
---

# Updated TypeScript Code: `src/ReproductionTracking/ReproductionTrackingConcept.ts`

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.ts
import { Collection, Db } from "npm:mongodb";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "ReproductionTracking" + ".";

/**
 * Enum for the sex of an offspring.
 */
export enum Sex {
  Male = "male",
  Female = "female",
  Neuter = "neutered",
}

/**
 * Represents a mother animal in the system.
 *
 * **state**: a set of `mothers` with
 *   - an `ID` of type `ID`
 *   - an optional `notes` of type `String`
 */
interface Mother {
  _id: ID;
  notes?: string;
}

/**
 * Represents a litter (a group of offspring born together).
 *
 * **state**: a set of `litters` with
 *   - an `ID` of type `ID`
 *   - a `motherId` of type `ID`
 *   - an optional `fatherId` of type `ID`
 *   - a `birthDate` of type `Date`
 *   - a `reportedLitterSize` of type `Number` (the initial count reported for this litter)
 *   - an optional `notes` of type `String`
 */
interface Litter {
  _id: ID;
  motherId: ID;
  fatherId?: ID;
  birthDate: Date;
  reportedLitterSize: number; // The initial or reported size of the litter
  notes?: string;
}

/**
 * Represents an individual offspring animal.
 *
 * **state**: a set of `offspring` with
 *   - an `ID` of type `ID`
 *   - a `litterId` of type `ID` (link to its parent litter)
 *   - a `sex` of type `Enum [male, female, neutered]`
 *   - an optional `notes` of type `String`
 *   - a `isAlive` of type `Bool`
 *   - a `survivedTillWeaning` of type `Bool`
 */
interface Offspring {
  _id: ID;
  litterId: ID;
  sex: Sex;
  notes?: string;
  isAlive: boolean;
  survivedTillWeaning: boolean;
}

/**
 * Represents a generated report.
 *
 * **state**: a set of `GeneratedReports` with
 *   - a `report name` of type `String`
 *   - a `dateGenerated` of type `Date`
 *   - a `target` of type `Set<ID>`
 *   - a set of `results` of type `(key-value pairs or tabular data)`
 */
interface GeneratedReport {
  _id: ID;
  reportName: string;
  dateGenerated: Date;
  target: ID[]; // Set of mother IDs this report covers
  results: Record<string, any>;
}

/**
 * **concept** ReproductionTracking
 *
 * **purpose** track reproductive outcomes and offspring survivability for breeding animals, organizing individual offspring into distinct litters.
 *
 * **principle**
 *   a user records birth events by first creating a litter for a mother animal, optionally linking a father and setting an expected litter size;
 *   then, individual offspring born to that litter are recorded and linked to it;
 *   later records weaning outcomes for those offspring when the data becomes available;
 *   uses this data to generate reports to evaluate reproductive performance and inform breeding decisions, including litter-specific metrics;
 *   can choose to generate an AI summary of generated reports to aide in understanding and decision making;
 */
export default class ReproductionTrackingConcept {
  private mothers: Collection<Mother>;
  private litters: Collection<Litter>; // New collection for Litters
  private offspring: Collection<Offspring>;
  private generatedReports: Collection<GeneratedReport>;

  constructor(private readonly db: Db) {
    this.mothers = this.db.collection(PREFIX + "mothers");
    this.litters = this.db.collection(PREFIX + "litters"); // Initialize litter collection
    this.offspring = this.db.collection(PREFIX + "offspring");
    this.generatedReports = this.db.collection(PREFIX + "generatedReports");
  }

  /**
   * **action** `addMother (motherId: ID): (motherId: ID)`
   *
   * **requires** mother is not already in the set of mothers
   * **effects** mother is added to the set of mothers
   */
  async addMother({ motherId }: { motherId: ID }): Promise<{ motherId?: ID; error?: string }> {
    const existingMother = await this.mothers.findOne({ _id: motherId });
    if (existingMother) {
      return { error: `Mother with ID ${motherId} already exists.` };
    }

    const newMother: Mother = { _id: motherId };
    await this.mothers.insertOne(newMother);
    return { motherId };
  }

  /**
   * **action** `removeMother (motherId: ID): (motherId: ID)`
   *
   * **requires** a mother with this ID is in the set of mothers
   * **effects** removes this mother from the set of mothers. (Associated litters and offspring will have dangling `motherId` references unless syncs are used for cascade deletion).
   */
  async removeMother({ motherId }: { motherId: ID }): Promise<{ motherId?: ID; error?: string }> {
    const result = await this.mothers.deleteOne({ _id: motherId });
    if (result.deletedCount === 0) {
      return { error: `Mother with ID ${motherId} not found.` };
    }
    return { motherId };
  }

  /**
   * **action** `recordLitter (motherId: ID, fatherId: ID?, birthDate: Date, reportedLitterSize: Number, notes: String?): (litter: Litter)`
   *
   * **requires** motherId exists. No litter with same `motherId`, `fatherId`, `birthDate` already exists (to prevent exact duplicates).
   * **effects** creates a new litter record with the provided information. Also adds the mother to the set of mothers if she isn't there already.
   */
  async recordLitter(
    { motherId, fatherId, birthDate, reportedLitterSize, notes }:
      { motherId: ID; fatherId?: ID; birthDate: Date; reportedLitterSize: number; notes?: string },
  ): Promise<{ litter?: Litter; error?: string }> {
    // Add mother if she doesn't exist already
    const existingMother = await this.mothers.findOne({ _id: motherId });
    if (!existingMother) {
      await this.addMother({ motherId }); // Assuming this succeeds or throws a critical error
    }

    // Check for existing litter with similar characteristics to avoid exact duplicates
    const existingLitter = await this.litters.findOne({ motherId, fatherId, birthDate: new Date(birthDate) });
    if (existingLitter) {
      return { error: `A litter for mother ${motherId} with this father and birth date already exists.` };
    }

    const newLitter: Litter = {
      _id: freshID(),
      motherId,
      fatherId,
      birthDate: new Date(birthDate),
      reportedLitterSize,
      notes,
    };

    await this.litters.insertOne(newLitter);
    return { litter: newLitter };
  }

  /**
   * **action** `updateLitter (litterId: ID, motherId: ID?, fatherId: ID?, birthDate: Date?, reportedLitterSize: Number?, notes: String?): (litter: Litter)`
   *
   * **requires** `litterId` exists
   * **effects** Updates any given information about the litter. If `motherId` is changed, ensures the new mother exists.
   */
  async updateLitter(
    { litterId, motherId, fatherId, birthDate, reportedLitterSize, notes }:
      { litterId: ID; motherId?: ID; fatherId?: ID; birthDate?: Date; reportedLitterSize?: number; notes?: string },
  ): Promise<{ litter?: Litter; error?: string }> {
    const existingLitter = await this.litters.findOne({ _id: litterId });
    if (!existingLitter) {
      return { error: `Litter with ID ${litterId} not found.` };
    }

    const updateFields: Partial<Litter> = {};
    if (fatherId !== undefined) updateFields.fatherId = fatherId;
    if (birthDate !== undefined) updateFields.birthDate = new Date(birthDate);
    if (reportedLitterSize !== undefined) updateFields.reportedLitterSize = reportedLitterSize;
    if (notes !== undefined) updateFields.notes = notes;

    // Handle mother ID change
    if (motherId !== undefined && motherId !== existingLitter.motherId) {
      const existingNewMother = await this.mothers.findOne({ _id: motherId });
      if (!existingNewMother) {
        await this.addMother({ motherId }); // Assuming success or critical failure
      }
      updateFields.motherId = motherId;
    }

    const updatedLitter: Litter | null = await this.litters.findOneAndUpdate(
      { _id: litterId },
      { $set: updateFields },
      { returnDocument: "after", upsert: false },
    );

    if (!updatedLitter) {
      return { error: `Failed to update litter with ID ${litterId}. Document not found or could not be updated.` };
    }
    return { litter: updatedLitter };
  }

  /**
   * **action** `recordOffspring (litterId: ID, offspringId: ID, sex: Enum [male, female, neutered], notes: String?): (offspring: Offspring)`
   *
   * **requires** `litterId` exists and `offspringId` does not exist.
   * **effects** creates an individual offspring record linked to the specified litter.
   */
  async recordOffspring(
    { litterId, offspringId, sex, notes }:
      { litterId: ID; offspringId: ID; sex: Sex; notes?: string },
  ): Promise<{ offspring?: Offspring; error?: string }> {
    const existingLitter = await this.litters.findOne({ _id: litterId });
    if (!existingLitter) {
      return { error: `Litter with ID ${litterId} not found.` };
    }

    const existingOffspring = await this.offspring.findOne({ _id: offspringId });
    if (existingOffspring) {
      return { error: `Offspring with ID ${offspringId} already exists.` };
    }

    const newOffspring: Offspring = {
      _id: offspringId,
      litterId,
      sex,
      notes,
      isAlive: true,
      survivedTillWeaning: false,
    };

    await this.offspring.insertOne(newOffspring);
    return { offspring: newOffspring };
  }

  /**
   * **action** `updateOffspring (offspringId: ID, litterId: ID?, sex: Enum?, notes: String?): (offspring: Offspring)`
   *
   * **requires** `offspringId` exists.
   * **effects** Updates any given information about the offspring. If `litterId` is changed, ensures the new litter exists.
   */
  async updateOffspring(
    { offspringId, litterId, sex, notes }:
      { offspringId: ID; litterId?: ID; sex?: Sex; notes?: string },
  ): Promise<{ offspring?: Offspring; error?: string }> {
    const existingOffspring = await this.offspring.findOne({ _id: offspringId });
    if (!existingOffspring) {
      return { error: `Offspring with ID ${offspringId} not found.` };
    }

    const updateFields: Partial<Offspring> = {};
    if (sex !== undefined) updateFields.sex = sex;
    if (notes !== undefined) updateFields.notes = notes;

    // Handle litter ID change
    if (litterId !== undefined && litterId !== existingOffspring.litterId) {
      const existingNewLitter = await this.litters.findOne({ _id: litterId });
      if (!existingNewLitter) {
        return { error: `New litter with ID ${litterId} for offspring update not found.` };
      }
      updateFields.litterId = litterId;
    }

    const updatedOffspring: Offspring | null = await this.offspring.findOneAndUpdate(
      { _id: offspringId },
      { $set: updateFields },
      { returnDocument: "after", upsert: false },
    );

    if (!updatedOffspring) {
      return { error: `Failed to update offspring with ID ${offspringId}. Document not found or could not be updated.` };
    }
    return { offspring: updatedOffspring };
  }

  /**
   * **action** `recordWeaning (offspringId: ID): offspringId: ID`
   *
   * **requires** offspring is in the set of offspring and is alive
   * **effects** Sets `survivedTillWeaning` to be true for the specified offspring
   */
  async recordWeaning({ offspringId }: { offspringId: ID }): Promise<{ offspringId?: ID; error?: string }> {
    const existingOffspring = await this.offspring.findOne({ _id: offspringId });
    if (!existingOffspring) {
      return { error: `Offspring with ID ${offspringId} not found.` };
    }
    if (!existingOffspring.isAlive) {
      return { error: `Offspring with ID ${offspringId} is not alive and cannot be weaned.` };
    }
    if (existingOffspring.survivedTillWeaning) {
      return { error: `Offspring with ID ${offspringId} is already marked as weaned.` };
    }

    const result = await this.offspring.updateOne(
      { _id: offspringId },
      { $set: { survivedTillWeaning: true } },
    );

    if (result.modifiedCount === 0) {
      return { error: `Failed to record weaning for offspring with ID ${offspringId}.` };
    }
    return { offspringId };
  }

  /**
   * **action** `recordDeath (offspringId: ID): (offspringId: ID)`
   *
   * **requires** offspring is in the set of offspring and is currently living
   * **effects** Sets the `isAlive` flag of this offspring to false
   */
  async recordDeath({ offspringId }: { offspringId: ID }): Promise<{ offspringId?: ID; error?: string }> {
    const existingOffspring = await this.offspring.findOne({ _id: offspringId });
    if (!existingOffspring) {
      return { error: `Offspring with ID ${offspringId} not found.` };
    }
    if (!existingOffspring.isAlive) {
      return { error: `Offspring with ID ${offspringId} is already marked as deceased.` };
    }

    const result = await this.offspring.updateOne(
      { _id: offspringId },
      { $set: { isAlive: false } },
    );

    if (result.modifiedCount === 0) {
      return { error: `Failed to record death for offspring with ID ${offspringId}.` };
    }
    return { offspringId };
  }

  /**
   * **action** `viewLittersOfMother (motherId: ID): (litters: Set<Litter>)`
   *
   * **requires** mother exists
   * **effects** returns all litters associated with the given mother ID.
   */
  async viewLittersOfMother({ motherId }: { motherId: ID }): Promise<{ litters?: Litter[]; error?: string }> {
    const existingMother = await this.mothers.findOne({ _id: motherId });
    if (!existingMother) {
      return { error: `Mother with ID ${motherId} not found.` };
    }
    const littersList = await this.litters.find({ motherId }).toArray();
    return { litters: littersList };
  }

  /**
   * **action** `viewOffspringOfLitter (litterId: ID): (offspring: Set<Offspring>)`
   *
   * **requires** litter exists
   * **effects** returns all offspring associated with the given litter ID.
   */
  async viewOffspringOfLitter({ litterId }: { litterId: ID }): Promise<{ offspring?: Offspring[]; error?: string }> {
    const existingLitter = await this.litters.findOne({ _id: litterId });
    if (!existingLitter) {
      return { error: `Litter with ID ${litterId} not found.` };
    }
    const offspringList = await this.offspring.find({ litterId }).toArray();
    return { offspring: offspringList };
  }

  /**
   * **action** `generateReport (target: Set<ID>, startDateRange: Date, endDateRange: Date, name: String?): (report: GeneratedReport)`
   *
   * **requires** All target animals are in the set of mothers
   * **effects** produce a report on the reproductive performance of the given animals within the specified date range and store it.
   */
  async generateReport(
    { target, startDateRange, endDateRange, name }:
      { target: ID[]; startDateRange: Date; endDateRange: Date; name?: string },
  ): Promise<{ report?: GeneratedReport; error?: string }> {
    // Validate target mothers
    const mothersExistCount = await this.mothers.countDocuments({ _id: { $in: target } });
    if (mothersExistCount !== target.length) {
      return { error: "One or more target IDs are not registered mothers." };
    }

    const reportName = name || `Reproduction Report - ${new Date().toISOString().split('T')[0]}`;
    const existingReport = await this.generatedReports.findOne({ reportName });
    if (existingReport) {
      return { error: `Report with name '${reportName}' already exists.` };
    }

    const startDate = new Date(startDateRange);
    const endDate = new Date(endDateRange);

    // --- Report Data Aggregation ---
    const relevantLitters = await this.litters.find({
      motherId: { $in: target },
      birthDate: { $gte: startDate, $lte: endDate },
    }).toArray();

    const litterIdsInReport = relevantLitters.map(l => l._id);

    const relevantOffspring = await this.offspring.find({
      litterId: { $in: litterIdsInReport },
    }).toArray();

    const uniqueLittersRecorded = relevantLitters.length;
    const totalReportedLitterSize = relevantLitters.reduce((sum, l) => sum + l.reportedLitterSize, 0);
    const totalActualOffspringBorn = relevantOffspring.length; // Count of individual offspring records linked to these litters
    const totalWeanedOffspring = relevantOffspring.filter((o) => o.survivedTillWeaning).length;
    const totalDeceasedOffspring = relevantOffspring.filter((o) => !o.isAlive).length;

    const averageReportedLitterSize = uniqueLittersRecorded > 0
      ? totalReportedLitterSize / uniqueLittersRecorded
      : 0;
    const averageActualOffspringPerLitter = uniqueLittersRecorded > 0
      ? totalActualOffspringBorn / uniqueLittersRecorded
      : 0;
    const survivabilityRateToWeaning = totalActualOffspringBorn > 0
      ? (totalWeanedOffspring / totalActualOffspringBorn) * 100
      : 0;

    const reportResults = {
      uniqueLittersRecorded,
      totalReportedLitterSize: totalReportedLitterSize,
      totalActualOffspringBorn: totalActualOffspringBorn,
      totalWeanedOffspring: totalWeanedOffspring,
      totalDeceasedOffspring: totalDeceasedOffspring,
      averageReportedLitterSize: parseFloat(averageReportedLitterSize.toFixed(2)),
      averageActualOffspringPerLitter: parseFloat(averageActualOffspringPerLitter.toFixed(2)),
      survivabilityRateToWeaning: `${survivabilityRateToWeaning.toFixed(2)}%`,
      motherCount: target.length,
      reportPeriod: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    };

    const newReport: GeneratedReport = {
      _id: freshID(),
      reportName,
      dateGenerated: new Date(),
      target,
      results: reportResults,
    };

    await this.generatedReports.insertOne(newReport);
    return { report: newReport };
  }

  /**
   * **action** `renameReport (oldName: String, newName: String): (report: GeneratedReport)`
   *
   * **requires** oldName of report exists
   * **effects** renames the specified report
   */
  async renameReport(
    { oldName, newName }: { oldName: string; newName: string },
  ): Promise<{ report?: GeneratedReport; error?: string }> {
    const existingReport = await this.generatedReports.findOne({ reportName: oldName });
    if (!existingReport) {
      return { error: `Report with name '${oldName}' not found.` };
    }

    const nameConflict = await this.generatedReports.findOne({ reportName: newName });
    if (nameConflict) {
      return { error: `Report with new name '${newName}' already exists.` };
    }

    const updatedReport: GeneratedReport | null = await this.generatedReports.findOneAndUpdate(
      { _id: existingReport._id },
      { $set: { reportName: newName } },
      { returnDocument: "after", upsert: false },
    );

    if (!updatedReport) {
      return { error: `Failed to rename report '${oldName}'. Document not found or could not be updated.` };
    }
    return { report: updatedReport };
  }

  /**
   * **action** `viewReport (reportName: String): (report: GeneratedReport)`
   *
   * **requires** report with the given name exists
   * **effects** returns the full details (summary and results) of the specified report
   */
  async viewReport({ reportName }: { reportName: string }): Promise<{ report?: GeneratedReport; error?: string }> {
    const report = await this.generatedReports.findOne({ reportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    return { report };
  }

  /**
   * **action** `listReports (): (reports: Set<GeneratedReport>)`
   *
   * **effects** returns all generated reports in the system
   */
  async listReports(): Promise<{ reports: GeneratedReport[] }> {
    const reports = await this.generatedReports.find({}).toArray();
    return { reports };
  }

  /**
   * **action** `deleteReport (reportName: String)`
   *
   * **requires** report with the given name exists
   * **effects** removes the specified report from the system
   */
  async deleteReport({ reportName }: { reportName: string }): Promise<Empty | { error: string }> {
    const result = await this.generatedReports.deleteOne({ reportName });
    if (result.deletedCount === 0) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    return {};
  }

  /**
   * **action** `aiSummary (reportName: String): (summary: String)`
   *
   * **requires** report exists
   * **effects** The AI generates a summary of the report, highlighting key takeaways and trends shown in the report.
   */
  async aiSummary({ reportName }: { reportName: string }): Promise<{ summary?: string; error?: string }> {
    const report = await this.generatedReports.findOne({ reportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return { error: "GEMINI_API_KEY environment variable is not set." };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // Updated prompt to reflect the new report structure with litters
      const prompt = `You are an expert animal husbandry analyst.
Please provide a concise and insightful summary of the following animal reproduction report.
Highlight key takeaways, trends, and actionable insights that can inform breeding decisions.
Focus on reproductive performance, litter management, and offspring survivability.

Reproduction Report Details:
Report Name: "${report.reportName}"
Date Generated: ${report.dateGenerated.toLocaleDateString()}
Target Mothers Count: ${report.results.motherCount}
Report Period: ${report.results.reportPeriod}

Metrics:
- Unique Litters Recorded: ${report.results.uniqueLittersRecorded}
- Total Reported Litter Size: ${report.results.totalReportedLitterSize}
- Total Actual Offspring Born (from these litters): ${report.results.totalActualOffspringBorn}
- Average Reported Litter Size: ${report.results.averageReportedLitterSize}
- Average Actual Offspring Per Litter: ${report.results.averageActualOffspringPerLitter}
- Total Individual Offspring Weaned: ${report.results.totalWeanedOffspring}
- Survivability Rate to Weaning: ${report.results.survivabilityRateToWeaning}
- Total Individual Offspring Deceased (Post-Birth, Pre-Weaning): ${report.results.totalDeceasedOffspring}

Based on this data, provide a professional summary:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      return { summary: summary.trim() };
    } catch (e) {
      console.error("Error generating AI summary:", e);
      return { error: `Failed to generate AI summary: ${e.message || "An unknown error occurred."}` };
    }
  }
}
```
