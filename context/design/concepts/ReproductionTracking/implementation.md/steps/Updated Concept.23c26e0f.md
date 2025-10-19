---
timestamp: 'Thu Oct 16 2025 01:57:27 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_015727.f7710e9e.md]]'
content_id: 23c26e0f0b140bf676dca4ba15e1ac4cd78522c2266437a41a1814dbb3231695
---

# Updated Concept: ReproductionTracking

* **purpose** track reproductive outcomes and offspring survivability for breeding animals, organizing individual offspring into distinct litters.

* **principle**
  a user records birth events by first creating a litter for a mother animal, optionally linking a father and setting an expected litter size;
  then, individual offspring born to that litter are recorded and linked to it;
  later records weaning outcomes for those offspring when the data becomes available;
  uses this data to generate reports to evaluate reproductive performance and inform breeding decisions, including litter-specific metrics;
  can choose to generate an AI summary of generated reports to aide in understanding and decision making;

* **state**
  * a set of `mothers` with
    * an `ID` of type `ID`
    * an optional `notes` of type `String`

  * a set of `litters` with
    * an `ID` of type `ID`
    * a `motherId` of type `ID` (link to the mother)
    * an optional `fatherId` of type `ID` (father of the litter)
    * a `birthDate` of type `Date` (birth date of the litter)
    * a `reportedLitterSize` of type `Number` (the number of offspring *reported* for this litter, for record-keeping; distinct from actual `offspring` count)
    * an optional `notes` of type `String`

  * a set of `offspring` with
    * an `ID` of type `ID`
    * a `litterId` of type `ID` (link to its parent litter)
    * a `sex` of type `Enum [male, female, neutered]`
    * an optional `notes` of type `String`
    * a `isAlive` of type `Bool`
    * a `survivedTillWeaning` of type `Bool`

  * a set of `GeneratedReports` with
    * a `report name` of type `String`
    * a `dateGenerated` of type `Date`
    * a `target` of type `Set<ID>`
    * a set of `results` of type `(key-value pairs or tabular data)`

* **actions**:
  * `addMother (motherId: ID): (motherId: ID)`
    * **requires** mother is not already in the set of mothers
    * **effects** mother is added to the set of mothers

  * `removeMother (motherId: ID): (motherId: ID)`
    * **requires** a mother with this ID is in the set of mothers
    * **effects** removes this mother from the set of mothers. (Associated litters and offspring will have dangling `motherId` references unless syncs are used for cascade deletion).

  * `recordLitter (motherId: ID, fatherId: ID?, birthDate: Date, reportedLitterSize: Number, notes: String?): (litter: Litter)`
    * **requires** motherId exists. No litter with same `motherId`, `fatherId`, `birthDate` already exists (to prevent exact duplicates).
    * **effects** creates a new litter record with the provided information. Also adds the mother to the set of mothers if she isn't there already.

  * `updateLitter (litterId: ID, motherId: ID?, fatherId: ID?, birthDate: Date?, reportedLitterSize: Number?, notes: String?): (litter: Litter)`
    * **requires** `litterId` exists
    * **effects** Updates any given information about the litter. If `motherId` is changed, ensures the new mother exists.

  * `recordOffspring (litterId: ID, offspringId: ID, sex: Enum [male, female, neutered], notes: String?): (offspring: Offspring)`
    * **requires** `litterId` exists and `offspringId` does not exist.
    * **effects** creates an individual offspring record linked to the specified litter.

  * `updateOffspring (offspringId: ID, litterId: ID?, sex: Enum?, notes: String?): (offspring: Offspring)`
    * **requires** `offspringId` exists.
    * **effects** Updates any given information about the offspring. If `litterId` is changed, ensures the new litter exists.

  * `recordWeaning (offspringId: ID): offspringId: ID`
    * **requires** offspring is in the set of offspring and is alive
    * **effects** Sets `survivedTillWeaning` to be true for the specified offspring

  * `recordDeath (offspringId: ID): (offspringId: ID)`
    * **requires** offspring is in the set of offspring and is currently living
    * **effects** Sets the `isAlive` flag of this offspring to false

  * `viewLittersOfMother (motherId: ID): (litters: Set<Litter>)`
    * **requires** mother exists
    * **effects** returns all litters associated with the given mother ID.

  * `viewOffspringOfLitter (litterId: ID): (offspring: Set<Offspring>)`
    * **requires** litter exists
    * **effects** returns all offspring associated with the given litter ID.

  * `generateReport (target: Set<ID>, startDateRange: Date, endDateRange: Date, name: String?): (report: GeneratedReport)`
    * **requires** All target animals are in the set of mothers
    * **effects** produce a report on the reproductive performance of the given animals within the specified date range

  * `renameReport (oldName: String, newName: String): (report: GeneratedReport)`
    * **requires** oldName of report exists
    * **effects** renames the specified report

  * `viewReport (reportName: String): (report: GeneratedReport)`
    * **requires** report with the given name exists
    * **effects** returns the summary and results of the report

  * `listReports (): (reports: Set<GeneratedReport>)`
    * **effects** return all generated reports

  * `deleteReport (reportName: String)`
    * **requires** report exists
    * **effects** remove the report from the system

  * `aiSummary (reportName: String): (summary: String)`
    * **requires** report exists
    * **effects** The AI generates a summary of the report, highlighting key takeaways and trends shown in the report.

***
