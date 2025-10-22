---
timestamp: 'Tue Oct 21 2025 15:37:53 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_153753.044d2606.md]]'
content_id: 784c6d586f73354eb5bcf79fc2f8adc76a39ba9b7f6876cd89e3bf65dd7b79b0
---

# API Specification: ReproductionTracking Concept

**Purpose:** track reproduction events and offspring for given parents

***

## API Endpoints

### POST /api/ReproductionTracking/registerParent

**Description:** Registers a new parent for reproduction tracking and returns its identifier.

**Requirements:**

* no Parent with the given `name` already exists

**Effects:**

* creates a new Parent `p`
* sets the name of `p` to `name`
* returns `p` as `parent`

**Request Body:**

```json
{
  "name": "string"
}
```

**Success Response Body (Action):**

```json
{
  "parent": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/registerOffspring

**Description:** Registers new offspring with specified parents and returns its identifier.

**Requirements:**

* no Offspring with the given `name` already exists
* `mother` exists
* `father` exists

**Effects:**

* creates a new Offspring `o`
* sets the name of `o` to `name`
* sets the mother of `o` to `mother`
* sets the father of `o` to `father`
* returns `o` as `offspring`

**Request Body:**

```json
{
  "name": "string",
  "mother": "string",
  "father": "string"
}
```

**Success Response Body (Action):**

```json
{
  "offspring": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReproductionTracking/\_getParentByName

**Description:** Retrieves a parent by its name.

**Requirements:**

* a Parent with the given `name` exists

**Effects:**

* returns the Parent with the given `name` as `parent`

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
    "parent": "string"
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

### POST /api/ReproductionTracking/\_getOffspringByName

**Description:** Retrieves offspring by its name.

**Requirements:**

* an Offspring with the given `name` exists

**Effects:**

* returns the Offspring with the given `name` as `offspring`

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
    "offspring": "string"
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

### POST /api/ReproductionTracking/\_getOffspringByParents

**Description:** Retrieves all offspring associated with a specified mother and father.

**Requirements:**

* `mother` exists
* `father` exists

**Effects:**

* returns all Offspring associated with `mother` and `father`

**Request Body:**

```json
{
  "mother": "string",
  "father": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "offspring": "string"
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

### POST /api/ReproductionTracking/\_getParentsByOffspring

**Description:** Retrieves the mother and father of a specified offspring.

**Requirements:**

* `offspring` exists

**Effects:**

* returns the mother of `offspring` as `mother` and the father of `offspring` as `father`

**Request Body:**

```json
{
  "offspring": "string"
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
