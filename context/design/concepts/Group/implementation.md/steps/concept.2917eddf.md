---
timestamp: 'Mon Oct 27 2025 12:29:03 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251027_122903.78f6adb2.md]]'
content_id: 2917eddf2ad46ba02e70bee69f6fef884226e9ba706c265a2b18c1fb50245bf0
---

# concept: HerdGrouping

* **purpose** organize animals into dynamic groupings for operational and analytical purposes

* **principle**\
  a user creates herds to group animals based on location, purpose, or management strategy, animals may be part of multiple herds;\
  adds or removes animals from herds as conditions change;\
  merges herds when combining groups, or splits them to separate animals;\
  moves animals between herds to reflect real-world transitions;\
  deletes herds (either archiving or permanently removing them depending on their current status);\
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
    * **requires** `sourceHerd` and `targetHerd` exist, are not archived, `animal` is a member of `sourceHerd`.
    * **effects** remove `animal` from `sourceHerd` and add it to `targetHerd` (if not already present).

  * `mergeHerds (herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}`
    * **requires** `herdNameToKeep` and `herdNameToArchive` exist, are not archived, and `herdNameToKeep` is not the same as `herdNameToArchive`.
    * **effects** move all animals from `herdNameToArchive` to `herdNameToKeep`. Mark `herdNameToArchive` as `isArchived: true` and clear its `members`.

  * `splitHerd (sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}`
    * **requires** `sourceHerd` exists and is not archived. All `animalsToMove` are members of `sourceHerd`. If `targetHerd` already exists, it must not be archived.
    * **effects** If `targetHerdName` does not exist, a new unarchived herd with that `name` and an empty `description` is created. Then, the specified `animalsToMove` are removed from `sourceHerd` and added to `targetHerd` (if not already present).

  * `deleteHerd (herdName: String): Empty | {error: String}`
    * **requires** a herd with `herdName` exists.
    * **effects** If the herd is not archived, it is flagged as `isArchived: true` and its `members` are cleared. If the herd is already archived, it is permanently removed from the database.

* **queries**
  * `_viewComposition (herdName: String): ({animals: Array<Animal>} | {error: String})`
    * **requires** a herd with `herdName` exists.
    * **effects** return the current members of the `herd`.

  * `_listActiveHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})`
    * **effects** return a list of all unarchived herds with their names, descriptions, and archived status.

  * `_listArchivedHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})`
    * **effects** return a list of all archived herds with their names, descriptions, and archived status.

***
