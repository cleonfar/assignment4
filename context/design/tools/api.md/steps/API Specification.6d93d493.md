---
timestamp: 'Tue Oct 21 2025 15:37:53 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_153753.044d2606.md]]'
content_id: 6d93d4938927bae72ef9f919c9cb72ee77e18233d8472ca4fcf63a81d4478d47
---

# API Specification: Group Concept

**Purpose:** support associating a named group of members with a set of items, so that members of the group have some relationship with the items (e.g. ownership, access, etc)

***

## API Endpoints

### POST /api/Group/createGroup

**Description:** Creates a new group with a given name and returns its identifier.

**Requirements:**

* no Group with the given `name` already exists

**Effects:**

* creates a new Group `g`
* sets the name of `g` to `name`
* returns `g` as `group`

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

***

### POST /api/Group/addMember

**Description:** Adds a member to an existing group.

**Requirements:**

* `group` exists
* `member` exists
* `member` is not already a member of `group`

**Effects:**

* adds `member` to the `members` set of `group`

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

***

### POST /api/Group/removeMember

**Description:** Removes a member from an existing group.

**Requirements:**

* `group` exists
* `member` exists
* `member` is a member of `group`

**Effects:**

* removes `member` from the `members` set of `group`

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

***

### POST /api/Group/addItem

**Description:** Adds an item to an existing group.

**Requirements:**

* `group` exists
* `item` exists
* `item` is not already an item of `group`

**Effects:**

* adds `item` to the `items` set of `group`

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

***

### POST /api/Group/removeItem

**Description:** Removes an item from an existing group.

**Requirements:**

* `group` exists
* `item` exists
* `item` is an item of `group`

**Effects:**

* removes `item` from the `items` set of `group`

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

***

### POST /api/Group/\_getGroupByName

**Description:** Retrieves a group by its name.

**Requirements:**

* a Group with the given `name` exists

**Effects:**

* returns the Group with the given `name` as `group`

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

***

### POST /api/Group/\_getGroupMembers

**Description:** Retrieves all members of a specified group.

**Requirements:**

* `group` exists

**Effects:**

* returns the set of all members in `group` as `member`

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

***

### POST /api/Group/\_getGroupItems

**Description:** Retrieves all items associated with a specified group.

**Requirements:**

* `group` exists

**Effects:**

* returns the set of all items in `group` as `item`

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

***

### POST /api/Group/\_getGroupsByMember

**Description:** Retrieves all groups that a specified member belongs to.

**Requirements:**

* `member` exists

**Effects:**

* returns the set of all groups that `member` belongs to as `group`

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

***

### POST /api/Group/\_getGroupsByItem

**Description:** Retrieves all groups that a specified item belongs to.

**Requirements:**

* `item` exists

**Effects:**

* returns the set of all groups that `item` belongs to as `group`

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

***
