---
timestamp: 'Tue Oct 21 2025 15:37:53 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_153753.044d2606.md]]'
content_id: 135a1ce63625c8fb6a7a76f4ef1cb83a599bd3d867db4f11fec17636a08ad27d
---

# API Specification: GrowthTracking Concept

**Purpose:** track growth metrics (e.g. weight, height) for a given subject over time

***

## API Endpoints

### POST /api/GrowthTracking/registerSubject

**Description:** Registers a new subject for growth tracking and returns its identifier.

**Requirements:**

* no Subject with the given `name` already exists

**Effects:**

* creates a new Subject `s`
* sets the name of `s` to `name`
* returns `s` as `subject`

**Request Body:**

```json
{
  "name": "string"
}
```

**Success Response Body (Action):**

```json
{
  "subject": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/GrowthTracking/recordMeasurement

**Description:** Records a new growth measurement for a specified subject.

**Requirements:**

* `subject` exists
* `timestamp` is a positive number
* `metricName` is not empty

**Effects:**

* creates a new Measurement `m`
* sets `subject` of `m` to `subject`
* sets `timestamp` to `timestamp`
* sets `metricName` to `metricName`
* sets `metricValue` to `metricValue`

**Request Body:**

```json
{
  "subject": "string",
  "timestamp": "number",
  "metricName": "string",
  "metricValue": "number"
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

### POST /api/GrowthTracking/\_getSubjectByName

**Description:** Retrieves a subject by its name.

**Requirements:**

* a Subject with the given `name` exists

**Effects:**

* returns the Subject with the given `name` as `subject`

**Request Body:**

```json
{
  "name": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "subject": "string"
  }
]
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/GrowthTracking/\_getMeasurementsBySubject

**Description:** Retrieves all growth measurements associated with a specified subject.

**Requirements:**

* `subject` exists

**Effects:**

* returns all Measurements associated with `subject`

**Request Body:**

```json
{
  "subject": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "timestamp": "number",
    "metricName": "string",
    "metricValue": "number"
  }
]
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***
