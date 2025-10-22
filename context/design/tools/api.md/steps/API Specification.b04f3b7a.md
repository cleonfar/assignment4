---
timestamp: 'Tue Oct 21 2025 15:37:53 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_153753.044d2606.md]]'
content_id: b04f3b7ab0af7df17b538c440b4699169e7dbd488cb06d3c3ce4481cec5a5dec
---

# API Specification: AnimalIdentity Concept

**Purpose:** give an animal a unique identity (e.g. name, ID tag) and track its parentage

***

## API Endpoints

### POST /api/AnimalIdentity/createAnimal

**Description:** Creates a new animal with a given name and returns its identifier.

**Requirements:**

* no Animal with the given `name` already exists

**Effects:**

* creates a new Animal `a`
* sets the name of `a` to `name`
* returns `a` as `animal`

**Request Body:**

```json
{
  "name": "string"
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

### POST /api/AnimalIdentity/setMother

**Description:** Sets the mother of an existing animal.

**Requirements:**

* `animal` exists
* `mother` exists

**Effects:**

* sets the mother of `animal` to `mother`

**Request Body:**

```json
{
  "animal": "string",
  "mother": "string"
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

### POST /api/AnimalIdentity/setFather

**Description:** Sets the father of an existing animal.

**Requirements:**

* `animal` exists
* `father` exists

**Effects:**

* sets the father of `animal` to `father`

**Request Body:**

```json
{
  "animal": "string",
  "father": "string"
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

### POST /api/AnimalIdentity/\_getAnimalByName

**Description:** Retrieves an animal by its name.

**Requirements:**

* an Animal with the given `name` exists

**Effects:**

* returns the Animal with the given `name` as `animal`

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
    "animal": "string"
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

### POST /api/AnimalIdentity/\_getAnimalParents

**Description:** Retrieves the mother and father of a specified animal.

**Requirements:**

* `animal` exists

**Effects:**

* returns the mother of `animal` as `mother` and the father of `animal` as `father`

**Request Body:**

```json
{
  "animal": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "mother": "string",
    "father": "string"
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
