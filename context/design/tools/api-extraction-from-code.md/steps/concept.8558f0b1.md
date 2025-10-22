---
timestamp: 'Mon Oct 20 2025 12:57:02 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_125702.ee8d08d1.md]]'
content_id: 8558f0b16274c0c6e949bacc2ac09df947392099ca9b58aab2422420018d132f
---

# concept: AnimalIdentity

* **purpose** represent individual animals with persistent identifiers and core attributes

* **principle**\
  a user registers animals to track them individually across their lifecycle;\
  assigns each animal a unique tag and records identifying details;\
  updates status to reflect key transitions such as sale, death, or transfer;

* **state**
  * a set of `Animals` with
    * an `id` tag of type `ID`
    * an optional `breed` of type `String`
    * a `sex` of type `Enum [male, female, neutered]`
    * a `status` of type `Enum [alive, sold, deceased]`
    * an optional `notes` of type `Strings`
    * an optional `birthDate` of type `Date`
    * an optional `mother` of type `ID`
    * an optional `father` of type `ID`
    * an optional set of `offspring` of type `(Set of IDs)`

* **actions**
  * `registerAnimal (id: ID, species: String, sex: Enum, birthDate: Date, breed?: String, mother?: ID, father?: ID, notes?: String): (animal: Animal)`
    * **requires** No animal with this ID is in the set of Animals
    * **effects** create a new animal with given attributes, status set to alive

  * `updateStatus (animal: Animal, status: Enum, notes: String)`
    * **requires** animal exists
    * **effects** set the animal’s status to the new value and record optional notes

  * `editDetails (animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum)`
    * **requires** animal exists
    * **effects** update the animal’s identifying attributes

  * `markAsTransferred (animal: AnimalID, date: Date, recipientNotes?: String): Empty`
    * **requires** animal exists, animal's status is alive
    * **effects** sets the animal’s status to 'transferred', and records the date and recipient notes in notes.

  * `markAsDeceased (animal: AnimalID, date: Date, cause?: String): Empty`
    * **requires** animal exists, animal's status is alive
    * **effects** sets the animal’s status to 'deceased', and records the date and cause in notes.

  * `markAsSold (animal: AnimalID, date: Date, buyerNotes?: String): Empty`
    * **requires** animal exists, animal's status is alive
    * **effects** sets the animal’s status to 'sold', and records the date and buyer notes in notes.

  * `setParent (animal: AnimalID, parentType: Enum[mother, father], parent: AnimalID): Empty`
    * **requires** animal exists, parent exists, parent's sex matches parentType, parent is not animal, no circular relationship would be created
    * **effects** links animal to parent (as mother or father), and adds animal to parent's offspring set.

  * `removeParent (animal: AnimalID, parentType: Enum[mother, father]): Empty`
    * **requires** animal exists, animal has parentType set
    * **effects** unlinks animal from specified parent, and removes animal from parent's offspring set.
