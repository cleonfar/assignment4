---
timestamp: 'Mon Oct 20 2025 21:22:50 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_212250.83c004db.md]]'
content_id: 23af630de56437a7452e9c19a13a4e85b3f2bf7d6ae08c8007b0cd5bf2997713
---

# API Specification: HerdGrouping Concept

**Purpose:** organize animals into dynamic groupings for operational and analytical purposes

***

## API Endpoints

### POST /api/HerdGrouping/createHerd

**Description:** Creates a new herd with a specified name, location, description, and no initial members.

**Requirements:**

* (Implicit: none specified)

**Effects:**

* create a new herd with this owner, name, location, and no members

**Request Body:**

```json
{
  "name": "string",
  "location": "string",
  "description": "string"
}
```

**Success Response Body (Action):**

```json
{
  "herdName": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/HerdGrouping/addAnimal

**Description:** Adds a specified animal to an existing herd and records an add event.

**Requirements:**

* herd exists and animal is in herd

**Effects:**

* add the animal to the herd and record an add event

**Request Body:**

```json
{
  "herdName": "string",
  "animal": "ID"
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

### POST /api/HerdGrouping/removeAnimal

**Description:** Removes a specified animal from an existing herd and records a remove event.

**Requirements:**

* herd exists and animal is a member

**Effects:**

* remove the animal from the herd and record a remove event

**Request Body:**

```json
{
  "herdName": "string",
  "animal": "ID"
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

### POST /api/HerdGrouping/moveAnimal

**Description:** Moves an animal from a source herd to a target herd and records a move event.

**Requirements:**

* both herds exist and animal is a member of source

**Effects:**

* remove the animal from source, add to target, and record a move event

**Request Body:**

```json
{
  "sourceHerd": "string",
  "targetHerd": "string",
  "animal": "ID"
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

### POST /api/HerdGrouping/mergeHerds

**Description:** Merges two existing herds by moving all animals from the second to the first, records a merge event, and archives both original herds.

**Requirements:**

* both herds exist

**Effects:**

* move all animals from source to target, record a merge event, and archive source and target herd.

**Request Body:**

```json
{
  "herd1": "string",
  "herd2": "string"
}
```

**Success Response Body (Action):**

```json
{
  "herdName": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/HerdGrouping/splitHerd

**Description:** Splits a source herd by moving a specified set of animals to a target herd, creating the target if it doesn't already exist.

**Requirements:**

* source herd exists and all animals are members of source

**Effects:**

* move specified animals from source to target, creating target if it does not already exist

**Request Body:**

```json
{
  "source": "string",
  "target": "string",
  "animals": "Array<ID>"
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
