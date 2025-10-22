---
timestamp: 'Mon Oct 20 2025 21:22:50 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_212250.83c004db.md]]'
content_id: 15a9d8263d3824be932a0d770fde66736758018c78484ecdec0b7e1787410989
---

# API Specification: AnimalIdentity Concept

**Purpose:** represent individual animals with persistent identifiers and core attributes

***

## API Endpoints

### POST /api/AnimalIdentity/registerAnimal

**Description:** Registers a new animal with a unique identifier and initial attributes, setting its status to 'alive'.

**Requirements:**

* No animal with this ID is in the set of Animals

**Effects:**

* create a new animal with given attributes, status set to alive

**Request Body:**

```json
{
  "id": "ID",
  "species": "string",
  "sex": "Enum [male, female, neutered]",
  "birthDate": "Date",
  "breed?": "string",
  "mother?": "ID",
  "father?": "ID",
  "notes?": "string"
}
```

**Success Response Body (Action):**

```json
{
  "animal": "ID"
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

**Description:** Updates the status of an existing animal and records optional notes.

**Requirements:**

* animal exists

**Effects:**

* set the animal’s status to the new value and record optional notes

**Request Body:**

```json
{
  "id": "ID",
  "status": "Enum [alive, sold, deceased]",
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

**Description:** Updates the identifying attributes of an existing animal.

**Requirements:**

* animal exists

**Effects:**

* update the animal’s identifying attributes

**Request Body:**

```json
{
  "id": "ID",
  "species": "string",
  "breed": "string",
  "birthDate": "Date",
  "sex": "Enum [male, female, neutered]"
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

**Description:** Sets an animal's status to 'transferred' and records the date and recipient notes.

**Requirements:**

* animal exists, animal's status is alive

**Effects:**

* sets the animal’s status to 'transferred', and records the date and recipient notes in notes.

**Request Body:**

```json
{
  "id": "ID",
  "date": "Date",
  "recipientNotes?": "string"
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

**Description:** Sets an animal's status to 'deceased' and records the date and optional cause.

**Requirements:**

* animal exists, animal's status is alive

**Effects:**

* sets the animal’s status to 'deceased', and records the date and cause in notes.

**Request Body:**

```json
{
  "id": "ID",
  "date": "Date",
  "cause?": "string"
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

**Description:** Sets an animal's status to 'sold' and records the date and optional buyer notes.

**Requirements:**

* animal exists, animal's status is alive

**Effects:**

* sets the animal’s status to 'sold', and records the date and buyer notes in notes.

**Request Body:**

```json
{
  "id": "ID",
  "date": "Date",
  "buyerNotes?": "string"
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
