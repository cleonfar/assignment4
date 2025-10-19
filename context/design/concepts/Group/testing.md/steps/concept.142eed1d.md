---
timestamp: 'Fri Oct 17 2025 22:15:40 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_221540.ad93ed7b.md]]'
content_id: 142eed1d46b8270addc161b09ff66758ee49a3373d83c2ba2b561963bbb4c975
---

# concept: HerdGrouping (Revised for Lenient Move/Split)

* **purpose** organize animals into dynamic groupings for operational and analytical purposes

* **principle**\
  a user creates herds to group animals based on location, purpose, or management strategy, animals may be part of multiple herds;\
  adds or removes animals from herds as conditions change;\
  merges herds when combining groups, or splits them to separate animals;\
  moves animals between herds to reflect real-world transitions;\
  and views herd composition and history to support planning and analysis.

* **state**
  * a set of `groups` with
    * a `name` of type `String` (unique, serves as identifier `_id`)
    * an optional `description` of type `String`
    * a `members` set of `Animal` IDs (an `Animal` is an `ID`)
    * a `isArchived` Boolean (default `false`)

* **actions**
  * `createHerd (name: String, description?: String): ({herdName: String} | {error: String})`
    * **requires** a herd with `name` does not already exist.
    * **effects** create a new herd with this `name`, optional `description`, `isArchived: false`, and an empty set of `members`. Return the `herdName`.

  * `addAnimal (herdName: String, animal: Animal): Empty | {error: String}`
    * **requires** a herd with `herdName` exists, is not archived, and `animal` is *not* already a member of the herd.
    * **effects** add the `animal` to the `members` of the specified `herd`.

  * `removeAnimal (herdName: String, animal: Animal): Empty | {error: String}`
    * **requires** a herd with `herdName` exists, is not archived, and `animal` is a member of the herd.
    * **effects** remove the `animal` from the `members` of the specified `herd`.

  * `moveAnimal (sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}`
    * **requires** `sourceHerd` and `targetHerd` exist, are not archived, and `animal` is a member of `sourceHerd`.
    * **effects** remove `animal` from `sourceHerd` and ensure it is a member of `targetHerd` (if `animal` was already in `targetHerd`, it remains there, not duplicated).

  * `mergeHerds (herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}`
    * **requires** `herdNameToKeep` and `herdNameToArchive` exist, are not archived, and `herdNameToKeep` is not the same as `herdNameToArchive`.
    * **effects** move all animals from `herdNameToArchive` to `herdNameToKeep`. Mark `herdNameToArchive` as `isArchived: true`.

  * `splitHerd (sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}`
    * **requires** `sourceHerd` and `targetHerd` exist, are not archived, and all `animalsToMove` are members of `sourceHerd`.
    * **effects** move specified `animalsToMove` from `sourceHerd` to `targetHerd` (for animals already in `targetHerd`, they remain, new ones are added, no duplicates).

* **queries**
  * `_viewComposition (herdName: String): ({animals: Array<Animal>} | {error: String})`
    * **requires** a herd with `herdName` exists.
    * **effects** return the current members of the `herd`.

  * `_listHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})`
    * **effects** return a list of all herds with their names, descriptions, and archived status.

***

### Updated Implementation

The changes primarily involve removing the `if (targetHerd.members.includes(animal))` checks and their associated error returns, as the `$addToSet` operator intrinsically handles avoiding duplicates.
