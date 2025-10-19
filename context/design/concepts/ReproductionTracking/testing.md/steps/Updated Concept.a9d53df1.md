---
timestamp: 'Thu Oct 16 2025 17:08:35 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_170835.1e105b5c.md]]'
content_id: a9d53df18b17ba5a56b8e8fb191fc9e4fd668612b99321afad56cc7bbfe9476e
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
    * an `ID` of type `String`
    * an optional `notes` of type `String`

  * a set of `litters` with
    * an `ID` of type `String`
    * a `motherId` of type `String` (link to the mother)
    * an optional `fatherId` of type `String` (father of the litter)
    * a `birthDate` of type `Date` (birth date of the litter)
    * a `reportedLitterSize` of type `Number` (the number of offspring *reported* for this litter, for record-keeping; distinct from actual `offspring` count)
    * an optional `notes` of type `String`

  * a set of `offspring` with
    * an `ID` of type `String`
    * a `litterId` of type `String` (link to its parent litter)
    * a `sex` of type `Enum [male, female, neutered]`
    * an optional `notes` of type `String`
    * a `isAlive` of type `Bool`
    * a `survivedTillWeaning` of type `Bool`

  * a set of `GeneratedReports` with
    * a `report name` of type `String`
    * a `dateGenerated` of type `Date`
    * a `target` of type `Set<String>`
    * a set of `results` of type `String`
    * a `summary` of type `String`

* **actions**:
  * `addMother (motherId: String): (motherId: String)`
    * **requires** mother is not already in the set of mothers
    * **effects** mother is added to the set of mothers

  * `removeMother (motherId: String): (motherId: String)`
    * **requires** a mother with this ID is in the set of mothers
    * **effects** removes this mother from the set of mothers. (Associated litters and offspring will have dangling `motherId` references unless syncs are used for cascade deletion).

  * `recordLitter (motherId: String, fatherId: String?, birthDate: Date, reportedLitterSize: Number, notes: String?): (litterID: String)`
    * **requires** motherId exists. No litter with same `motherId`, `fatherId`, `birthDate` already exists (to prevent exact duplicates).
    * **effects** creates a new litter record with the provided information. Also adds the mother to the set of mothers if she isn't there already.

  * `updateLitter (litterId: String, motherId: String?, fatherId: String?, birthDate: Date?, reportedLitterSize: Number?, notes: String?): (litterID: String)`
    * **requires** `litterId` exists
    * **effects** Updates any given information about the litter. If `motherId` is changed, ensures the new mother exists.

  * `recordOffspring (litterId: String, offspringId: String, sex: Enum [male, female, neutered], notes: String?): (offspringID: String)`
    * **requires** `litterId` exists and `offspringId` does not exist.
    * **effects** creates an individual offspring record linked to the specified litter.

  * `updateOffspring (offspringId: String, litterId: String?, sex: Enum?, notes: String?): (offspringID: String)`
    * **requires** `offspringId` exists.
    * **effects** Updates any given information about the offspring. If `litterId` is changed, ensures the new litter exists.

  * `recordWeaning (offspringId: String): (offspringID: String)`
    * **requires** offspring is in the set of offspring and is alive
    * **effects** Sets `survivedTillWeaning` to be true for the specified offspring

  * `recordDeath (offspringId: String): (offspringId: String)`
    * **requires** offspring is in the set of offspring and is currently living
    * **effects** Sets the `isAlive` flag of this offspring to false

  * `generateReport (target: String, startDateRange: Date, endDateRange: Date, name: String): (reportName: String)`
    * **requires** target animal is in the set of mothers
    * **effects** If no report with this name exists then generate a report on the reproductive performance of the given animal within the specified date range, otherwise add the reproductive performance of this animal to the existing report.

  * `renameReport (oldName: String, newName: String): (newName: String)`
    * **requires** oldName of report exists
    * **effects** renames the specified report

  * `viewReport (reportName: String): (Results: String)`
    * **requires** report with the given name exists
    * **effects** results of the report

  * `deleteReport (reportName: String)`
    * **requires** report exists
    * **effects** remove the report from the system

  * `aiSummary (reportName: String): (summary: String)`
    * **requires** report exists
    * **effects** The AI generates a summary of the report, highlighting key takeaways and trends shown in the report, and saves it for future viewing
