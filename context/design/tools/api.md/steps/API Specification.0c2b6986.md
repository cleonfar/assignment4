---
timestamp: 'Mon Oct 20 2025 21:22:50 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_212250.83c004db.md]]'
content_id: 0c2b69864b0cc7262ffc3bc50774d26a4876498ab32cbe141f3d011245d89ec5
---

# API Specification: ReproductionTracking Concept

**Purpose:** track reproductive outcomes and offspring survivability for breeding animals, organizing individual offspring into distinct litters.

***

## API Endpoints

### POST /api/ReproductionTracking/addMother

**Description:** Adds a new animal to the set of mothers for tracking reproductive performance.

**Requirements:**

* mother is not already in the set of mothers

**Effects:**

* mother is added to the set of mothers

**Request Body:**

```json
{
  "motherId": "string"
}
```

**Success Response Body (Action):**

```json
{
  "motherId": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/removeMother

**Description:** Removes an animal from the set of mothers.

**Requirements:**

* a mother with this ID is in the set of mothers

**Effects:**

* removes this mother from the set of mothers. (Associated litters and offspring will have dangling `motherId` references unless syncs are used for cascade deletion).

**Request Body:**

```json
{
  "motherId": "string"
}
```

**Success Response Body (Action):**

```json
{
  "motherId": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/recordLitter

**Description:** Records a new litter born to a mother, optionally linking a father, specifying birth date and reported litter size, and including notes.

**Requirements:**

* motherId exists. No litter with same `motherId`, `fatherId`, `birthDate` already exists (to prevent exact duplicates).

**Effects:**

* creates a new litter record with the provided information. Also adds the mother to the set of mothers if she isn't there already.

**Request Body:**

```json
{
  "motherId": "string",
  "fatherId?": "string",
  "birthDate": "Date",
  "reportedLitterSize": "number",
  "notes?": "string"
}
```

**Success Response Body (Action):**

```json
{
  "litterID": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/updateLitter

**Description:** Updates any given information for a specific litter.

**Requirements:**

* `litterId` exists

**Effects:**

* Updates any given information about the litter. If `motherId` is changed, ensures the new mother exists.

**Request Body:**

```json
{
  "litterId": "string",
  "motherId?": "string",
  "fatherId?": "string",
  "birthDate?": "Date",
  "reportedLitterSize?": "number",
  "notes?": "string"
}
```

**Success Response Body (Action):**

```json
{
  "litterID": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/recordOffspring

**Description:** Creates an individual offspring record linked to the specified litter with its sex and optional notes.

**Requirements:**

* `litterId` exists and `offspringId` does not exist.

**Effects:**

* creates an individual offspring record linked to the specified litter.

**Request Body:**

```json
{
  "litterId": "string",
  "offspringId": "string",
  "sex": "Enum [male, female, neutered]",
  "notes?": "string"
}
```

**Success Response Body (Action):**

```json
{
  "offspringID": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/updateOffspring

**Description:** Updates any given information for a specific offspring.

**Requirements:**

* `offspringId` exists.

**Effects:**

* Updates any given information about the offspring. If `litterId` is changed, ensures the new litter exists.

**Request Body:**

```json
{
  "offspringId": "string",
  "litterId?": "string",
  "sex?": "Enum [male, female, neutered]",
  "notes?": "string"
}
```

**Success Response Body (Action):**

```json
{
  "offspringID": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/recordWeaning

**Description:** Sets the `survivedTillWeaning` flag to true for a specified offspring.

**Requirements:**

* offspring is in the set of offspring and is alive

**Effects:**

* Sets `survivedTillWeaning` to be true for the specified offspring

**Request Body:**

```json
{
  "offspringId": "string"
}
```

**Success Response Body (Action):**

```json
{
  "offspringID": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/recordDeath

**Description:** Sets the `isAlive` flag of a specified offspring to false.

**Requirements:**

* offspring is in the set of offspring and is currently living

**Effects:**

* Sets the `isAlive` flag of this offspring to false

**Request Body:**

```json
{
  "offspringId": "string"
}
```

**Success Response Body (Action):**

```json
{
  "offspringId": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/generateReport

**Description:** Generates a new reproductive performance report or adds reproductive performance data for a given animal to an existing report within a specified date range.

**Requirements:**

* target animal is in the set of mothers

**Effects:**

* If no report with this name exists then generate a report on the reproductive performance of the given animal within the specified date range, otherwise add the reproductive performance of this animal to the existing report.

**Request Body:**

```json
{
  "target": "string",
  "startDateRange": "Date",
  "endDateRange": "Date",
  "name": "string"
}
```

**Success Response Body (Action):**

```json
{
  "Results": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/renameReport

**Description:** Renames an existing reproductive performance report.

**Requirements:**

* oldName of report exists

**Effects:**

* renames the specified report

**Request Body:**

```json
{
  "oldName": "string",
  "newName": "string"
}
```

**Success Response Body (Action):**

```json
{
  "newName": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/deleteReport

**Description:** Deletes a specified reproductive performance report from the system.

**Requirements:**

* report exists

**Effects:**

* remove the report from the system

**Request Body:**

```json
{
  "reportName": "string"
}
```

**Success Response Body (Action):**

```json
{}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/aiSummary

**Description:** Generates an AI-powered summary of a specified reproductive performance report and saves it.

**Requirements:**

* report exists

**Effects:**

* The AI generates a summary of the report, highlighting key takeaways and trends shown in the report, and saves it for future viewing

**Request Body:**

```json
{
  "reportName": "string"
}
```

**Success Response Body (Action):**

```json
{
  "summary": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***
