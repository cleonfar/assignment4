---
timestamp: 'Sun Nov 02 2025 16:03:24 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_160324.74adff65.md]]'
content_id: fff4c7f19ee89bdf73d6480d7a8f8dda4a510b1f7f7fcdd7b363d29aea52c4f7
---

# concept: HerdGrouping

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
    * **requires** `sourceHerd` and `targetHerd` exist, are not archived, `animal` is a member of `sourceHerd`, and `animal` is *not* a member of `targetHerd`.
    * **effects** remove `animal` from `sourceHerd` and add it to `targetHerd`.

  * `mergeHerds (herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}`
    * **requires** `herdNameToKeep` and `herdNameToArchive` exist, are not archived, and `herdNameToKeep` is not the same as `herdNameToArchive`.
    * **effects** move all animals from `herdNameToArchive` to `herdNameToKeep`. Mark `herdNameToArchive` as `isArchived: true`.

  * `splitHerd (sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}`
    * **requires** `sourceHerd` and `targetHerd` exist, are not archived, and all `animalsToMove` are members of `sourceHerd` and *not* members of `targetHerd`.
    * **effects** move specified `animalsToMove` from `sourceHerd` to `targetHerd`.

* **queries**
  * `_viewComposition (herdName: String): ({animals: Array<Animal>} | {error: String})`
    * **requires** a herd with `herdName` exists.
    * **effects** return the current members of the `herd`.

  * `_listHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})`
    * **effects** return a list of all herds with their names, descriptions, and archived status.

***
