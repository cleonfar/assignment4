---
timestamp: 'Mon Oct 20 2025 12:57:42 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_125742.c20b4f54.md]]'
content_id: cdcf1b72a88ad4b660b341bd17dc806ab8017069e9f485b1614b71c5baf7fa2c
---

# API Specification: AnimalIdentity Concept

**Purpose:** represent individual animals with persistent identifiers and core attributes

***

## API Endpoints

### POST /api/AnimalIdentity/registerAnimal

**Description:** Registers a new animal with a unique identifier and its core attributes.

**Requirements:**

* No animal with this ID is in the set of Animals

**Effects:**

* create a new animal with given attributes, status set to alive

**Request Body:**

```json
{
  "id": "string",
  "species": "string",
  "sex": "Enum[male, female, neutered]",
  "birthDate": "string (ISO 8601 Date)",
  "breed": "string (optional)",
  "notes": "string (optional)"
}
```

**Success Response Body (Action):**

```json
{
  "animal": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/AnimalIdentity/updateStatus

**Description:** Updates the status of an existing animal and records any associated notes.

**Requirements:**

* animal exists

**Effects:**

* set the animal’s status to the new value and record optional notes

**Request Body:**

```json
{
  "animal": "string",
  "status": "Enum[alive, sold, deceased, transferred]",
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

### POST /api/AnimalIdentity/editDetails

**Description:** Modifies the identifying attributes of an existing animal.

**Requirements:**

* animal exists

**Effects:**

* update the animal’s identifying attributes

**Request Body:**

```json
{
  "animal": "string",
  "species": "string",
  "breed": "string",
  "birthDate": "string (ISO 8601 Date)",
  "sex": "Enum[male, female, neutered]"
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

### POST /api/AnimalIdentity/markAsTransferred

**Description:** Marks an animal as transferred, recording the date and any recipient-specific notes.

**Requirements:**

* animal exists, animal's status is alive

**Effects:**

* sets the animal’s status to 'transferred', and records the date and recipient notes in notes.

**Request Body:**

```json
{
  "animal": "string",
  "date": "string (ISO 8601 Date)",
  "recipientNotes": "string (optional)"
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

### POST /api/AnimalIdentity/markAsDeceased

**Description:** Marks an animal as deceased, recording the date and cause.

**Requirements:**

* animal exists, animal's status is alive

**Effects:**

* sets the animal’s status to 'deceased', and records the date and cause in notes.

**Request Body:**

```json
{
  "animal": "string",
  "date": "string (ISO 8601 Date)",
  "cause": "string (optional)"
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

### POST /api/AnimalIdentity/markAsSold

**Description:** Marks an animal as sold, recording the date and any buyer-specific notes.

**Requirements:**

* animal exists, animal's status is alive

**Effects:**

* sets the animal’s status to 'sold', and records the date and buyer notes in notes.

**Request Body:**

```json
{
  "animal": "string",
  "date": "string (ISO 8601 Date)",
  "buyerNotes": "string (optional)"
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

### POST /api/AnimalIdentity/\_getAnimal

**Description:** Retrieves the full details of a single animal by its ID.

**Requirements:**

* None explicitly stated, but implies `id` must refer to an existing animal.

**Effects:**

* return the animal document for the given ID

**Request Body:**

```json
{
  "id": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "animal": {
      "_id": "string",
      "species": "string",
      "breed": "string",
      "sex": "Enum[male, female, neutered]",
      "status": "Enum[alive, sold, deceased, transferred]",
      "notes": "string",
      "birthDate": "string (ISO 8601 Date) | null"
    }
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

### POST /api/AnimalIdentity/\_getAllAnimals

**Description:** Retrieves a list of all registered animals with their core attributes.

**Requirements:**

* None

**Effects:**

* return all animal documents

**Request Body:**

```json
{}
```

**Success Response Body (Query):**

```json
[
  {
    "animals": [
      {
        "_id": "string",
        "species": "string",
        "breed": "string",
        "sex": "Enum[male, female, neutered]",
        "status": "Enum[alive, sold, deceased, transferred]",
        "notes": "string",
        "birthDate": "string (ISO 8601 Date) | null"
      }
      // ... potentially more animal objects
    ]
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
