[@api-extraction-from-code](api-extraction-from-code.md)  

[text](../concepts/AnimalIdentity/implementation.md)  

[text](../concepts/Group/implementation.md)  
  
[text](../concepts/GrowthTracking/implementation.md)  

[text](../concepts/ReproductionTracking/implementation.md)  
# response:

# API Specification: AnimalIdentity Concept

**Purpose:** give an animal a unique identity (e.g. name, ID tag) and track its parentage

---

## API Endpoints

### POST /api/AnimalIdentity/createAnimal

**Description:** Creates a new animal with a given name and returns its identifier.

**Requirements:**
- no Animal with the given `name` already exists

**Effects:**
- creates a new Animal `a`
- sets the name of `a` to `name`
- returns `a` as `animal`

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

---

### POST /api/AnimalIdentity/setMother

**Description:** Sets the mother of an existing animal.

**Requirements:**
- `animal` exists
- `mother` exists

**Effects:**
- sets the mother of `animal` to `mother`

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

---

### POST /api/AnimalIdentity/setFather

**Description:** Sets the father of an existing animal.

**Requirements:**
- `animal` exists
- `father` exists

**Effects:**
- sets the father of `animal` to `father`

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

---

### POST /api/AnimalIdentity/_getAnimalByName

**Description:** Retrieves an animal by its name.

**Requirements:**
- an Animal with the given `name` exists

**Effects:**
- returns the Animal with the given `name` as `animal`

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

---

### POST /api/AnimalIdentity/_getAnimalParents

**Description:** Retrieves the mother and father of a specified animal.

**Requirements:**
- `animal` exists

**Effects:**
- returns the mother of `animal` as `mother` and the father of `animal` as `father`

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

---

# API Specification: Group Concept

**Purpose:** support associating a named group of members with a set of items, so that members of the group have some relationship with the items (e.g. ownership, access, etc)

---

## API Endpoints

### POST /api/Group/createGroup

**Description:** Creates a new group with a given name and returns its identifier.

**Requirements:**
- no Group with the given `name` already exists

**Effects:**
- creates a new Group `g`
- sets the name of `g` to `name`
- returns `g` as `group`

**Request Body:**
```json
{
  "name": "string"
}
```

**Success Response Body (Action):**
```json
{
  "group": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/Group/addMember

**Description:** Adds a member to an existing group.

**Requirements:**
- `group` exists
- `member` exists
- `member` is not already a member of `group`

**Effects:**
- adds `member` to the `members` set of `group`

**Request Body:**
```json
{
  "group": "string",
  "member": "string"
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

---

### POST /api/Group/removeMember

**Description:** Removes a member from an existing group.

**Requirements:**
- `group` exists
- `member` exists
- `member` is a member of `group`

**Effects:**
- removes `member` from the `members` set of `group`

**Request Body:**
```json
{
  "group": "string",
  "member": "string"
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

---

### POST /api/Group/addItem

**Description:** Adds an item to an existing group.

**Requirements:**
- `group` exists
- `item` exists
- `item` is not already an item of `group`

**Effects:**
- adds `item` to the `items` set of `group`

**Request Body:**
```json
{
  "group": "string",
  "item": "string"
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

---

### POST /api/Group/removeItem

**Description:** Removes an item from an existing group.

**Requirements:**
- `group` exists
- `item` exists
- `item` is an item of `group`

**Effects:**
- removes `item` from the `items` set of `group`

**Request Body:**
```json
{
  "group": "string",
  "item": "string"
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

---

### POST /api/Group/_getGroupByName

**Description:** Retrieves a group by its name.

**Requirements:**
- a Group with the given `name` exists

**Effects:**
- returns the Group with the given `name` as `group`

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
    "group": "string"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/Group/_getGroupMembers

**Description:** Retrieves all members of a specified group.

**Requirements:**
- `group` exists

**Effects:**
- returns the set of all members in `group` as `member`

**Request Body:**
```json
{
  "group": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "member": "string"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/Group/_getGroupItems

**Description:** Retrieves all items associated with a specified group.

**Requirements:**
- `group` exists

**Effects:**
- returns the set of all items in `group` as `item`

**Request Body:**
```json
{
  "group": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "item": "string"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/Group/_getGroupsByMember

**Description:** Retrieves all groups that a specified member belongs to.

**Requirements:**
- `member` exists

**Effects:**
- returns the set of all groups that `member` belongs to as `group`

**Request Body:**
```json
{
  "member": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "group": "string"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/Group/_getGroupsByItem

**Description:** Retrieves all groups that a specified item belongs to.

**Requirements:**
- `item` exists

**Effects:**
- returns the set of all groups that `item` belongs to as `group`

**Request Body:**
```json
{
  "item": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "group": "string"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

# API Specification: GrowthTracking Concept

**Purpose:** track growth metrics (e.g. weight, height) for a given subject over time

---

## API Endpoints

### POST /api/GrowthTracking/registerSubject

**Description:** Registers a new subject for growth tracking and returns its identifier.

**Requirements:**
- no Subject with the given `name` already exists

**Effects:**
- creates a new Subject `s`
- sets the name of `s` to `name`
- returns `s` as `subject`

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

---

### POST /api/GrowthTracking/recordMeasurement

**Description:** Records a new growth measurement for a specified subject.

**Requirements:**
- `subject` exists
- `timestamp` is a positive number
- `metricName` is not empty

**Effects:**
- creates a new Measurement `m`
- sets `subject` of `m` to `subject`
- sets `timestamp` to `timestamp`
- sets `metricName` to `metricName`
- sets `metricValue` to `metricValue`

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

---

### POST /api/GrowthTracking/_getSubjectByName

**Description:** Retrieves a subject by its name.

**Requirements:**
- a Subject with the given `name` exists

**Effects:**
- returns the Subject with the given `name` as `subject`

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

---

### POST /api/GrowthTracking/_getMeasurementsBySubject

**Description:** Retrieves all growth measurements associated with a specified subject.

**Requirements:**
- `subject` exists

**Effects:**
- returns all Measurements associated with `subject`

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

---

# API Specification: ReproductionTracking Concept

**Purpose:** track reproduction events and offspring for given parents

---

## API Endpoints

### POST /api/ReproductionTracking/registerParent

**Description:** Registers a new parent for reproduction tracking and returns its identifier.

**Requirements:**
- no Parent with the given `name` already exists

**Effects:**
- creates a new Parent `p`
- sets the name of `p` to `name`
- returns `p` as `parent`

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

---

### POST /api/ReproductionTracking/registerOffspring

**Description:** Registers new offspring with specified parents and returns its identifier.

**Requirements:**
- no Offspring with the given `name` already exists
- `mother` exists
- `father` exists

**Effects:**
- creates a new Offspring `o`
- sets the name of `o` to `name`
- sets the mother of `o` to `mother`
- sets the father of `o` to `father`
- returns `o` as `offspring`

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

---

### POST /api/ReproductionTracking/_getParentByName

**Description:** Retrieves a parent by its name.

**Requirements:**
- a Parent with the given `name` exists

**Effects:**
- returns the Parent with the given `name` as `parent`

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

---

### POST /api/ReproductionTracking/_getOffspringByName

**Description:** Retrieves offspring by its name.

**Requirements:**
- an Offspring with the given `name` exists

**Effects:**
- returns the Offspring with the given `name` as `offspring`

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

---

### POST /api/ReproductionTracking/_getOffspringByParents

**Description:** Retrieves all offspring associated with a specified mother and father.

**Requirements:**
- `mother` exists
- `father` exists

**Effects:**
- returns all Offspring associated with `mother` and `father`

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

---

### POST /api/ReproductionTracking/_getParentsByOffspring

**Description:** Retrieves the mother and father of a specified offspring.

**Requirements:**
- `offspring` exists

**Effects:**
- returns the mother of `offspring` as `mother` and the father of `offspring` as `father`

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