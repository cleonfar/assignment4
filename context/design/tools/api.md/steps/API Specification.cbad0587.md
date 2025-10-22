---
timestamp: 'Mon Oct 20 2025 21:22:50 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_212250.83c004db.md]]'
content_id: cbad0587f7c21b392146c7cd112e6daf19551fcd079f59c6cb4bbb770d795c54
---

# API Specification: GrowthTracking Concept

**Purpose:** track animal growth information

***

## API Endpoints

### POST /api/GrowthTracking/recordWeight

**Description:** Records a new weight measurement for a specific animal.

**Requirements:**

* animal exists

**Effects:**

* create a new weight record for this animal

**Request Body:**

```json
{
  "animal": "ID",
  "date": "Date",
  "weight": "number",
  "notes": "string"
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

### POST /api/GrowthTracking/removeWeightRecord

**Description:** Removes an existing weight record for an animal on a given date.

**Requirements:**

* there is a weight record for this animal on the given date

**Effects:**

* remove the given weight record from the animal's set of weight records

**Request Body:**

```json
{
  "animal": "ID",
  "date": "Date"
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

### POST /api/GrowthTracking/generateReport

**Description:** Generates a new growth performance report or adds growth performance data for a given animal to an existing report within a specified date range.

**Requirements:**

* target animal is in the set of mothers

**Effects:**

* If no report with this name exists then generate a report on the growth performance of the given animal within the specified date range, otherwise add the growth performance of this animal to the existing report. The report should include each recorded weight of each animal as well as their average daily rate of gain over each time period.

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

### POST /api/GrowthTracking/renameReport

**Description:** Renames an existing growth tracking report.

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

### POST /api/GrowthTracking/deleteReport

**Description:** Deletes a specified growth tracking report from the system.

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

### POST /api/GrowthTracking/aiSummary

**Description:** Generates an AI-powered summary of a specified growth tracking report and saves it.

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
