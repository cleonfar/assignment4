---
timestamp: 'Tue Oct 21 2025 15:23:31 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_152331.0a9aa404.md]]'
content_id: ffbd244bc4dddcc332415555fea386a7e53cdc8bddbe0f9858b73831324d0f92
---

# concept: AnimalIdentity (Updated)

* **purpose** represent individual animals with persistent identifiers and core attributes

* **principle**
  a user registers animals to track them individually across their lifecycle;
  assigns each animal a unique tag and records identifying details;
  updates status to reflect key transitions such as sale, death, or transfer;

* **state**
  * a set of `Animals` with
    * an `id` tag of type `ID`
    * a `species` of type `String`
    * an optional `breed` of type `String`
    * a `sex` of type `Enum [male, female, neutered]`
    * a `status` of type `Enum [alive, sold, deceased, transferred]`
    * an optional `notes` of type `String`
    * an optional `birthDate` of type `Date`

* **actions**
  * `registerAnimal (id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, notes?: String): (animal: Animal)`
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

* **queries**
  * `_getAnimal (id: ID): (animal: AnimalDocument)`
    * **requires** animal with `id` exists
    * **effects** returns the animal document for the given ID

  * `_getAllAnimals (): (animals: AnimalDocument[])`
    * **requires** true
    * **effects** returns a list of all animal documents

***
