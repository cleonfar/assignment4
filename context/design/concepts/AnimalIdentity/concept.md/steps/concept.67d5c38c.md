---
timestamp: 'Tue Oct 21 2025 18:07:17 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_180717.872d4444.md]]'
content_id: 67d5c38cb8dd62939752716593dbdfbe48361f2bc5953aa07a4ef9b59c20f166
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

* **actions**
  * `registerAnimal (id: ID, species: String, sex: Enum, birthDate: Date, breed?: String, mother?: ID, father?: ID, notes?: String): (animal: Animal)`
    * **requires** No animal with this ID is in the set of Animals
    * **effects** create a new animal with given attributes, status set to alive

  * `updateStatus (id: ID, status: Enum, notes: String)`
    * **requires** animal exists
    * **effects** set the animal’s status to the new value and record optional notes

  * `editDetails (id: ID, species: String, breed: String, birthDate: Date, sex: Enum)`
    * **requires** animal exists
    * **effects** update the animal’s identifying attributes

  * `markAsTransferred (id: ID, date: Date, recipientNotes?: String): Empty`
    * **requires** animal exists, animal's status is alive
    * **effects** sets the animal’s status to 'transferred', and records the date and recipient notes in notes.

  * `markAsDeceased (id: ID, date: Date, cause?: String): Empty`
    * **requires** animal exists, animal's status is alive
    * **effects** sets the animal’s status to 'deceased', and records the date and cause in notes.

  * `markAsSold (id: ID, date: Date, buyerNotes?: String): Empty`
    * **requires** animal exists, animal's status is alive
    * **effects** sets the animal’s status to 'sold', and records the date and buyer notes in notes.
