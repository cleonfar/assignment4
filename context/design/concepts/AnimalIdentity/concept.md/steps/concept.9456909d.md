---
timestamp: 'Tue Nov 04 2025 18:17:33 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_181733.e48acaa7.md]]'
content_id: 9456909d70f69378f8490accc1f234eb152e8bfa1e4dc27a51b7494c01b4496f
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
  * `registerAnimal (id: ID, species: String, sex: Enum, birthDate: Date, breed?: String, mother?: ID, father?: ID, notes?: String, user: String): (animal: Animal)`
    * **requires** No animal with this ID and this user is in the set of Animals
    * **effects** create a new animal with given attributes, status set to alive

  * `updateStatus (id: ID, status: Enum, notes: String, user: String), Empty`
    * **requires** animal exists for the given user
    * **effects** set the animal’s status to the new value and record optional notes

  * `editDetails (id: ID, species: String, breed: String, birthDate: Date, sex: Enum, user: String): Empty`
    * **requires** animal exists for the given user
    * **effects** update the animal’s identifying attributes

  * `markAsTransferred (id: ID, date: Date, recipientNotes?: String, user: String): Empty`
    * **requires** animal exists for the given user, animal's status is alive
    * **effects** sets the animal’s status to 'transferred', and records the date and recipient notes in notes.

  * `markAsDeceased (id: ID, date: Date, cause?: String, user: String): Empty`
    * **requires** animal exists for the given user, animal's status is alive
    * **effects** sets the animal’s status to 'deceased', and records the date and cause in notes.

  * `markAsSold (id: ID, date: Date, buyerNotes?: String, user: String): Empty`
    * **requires** animal exists for the given user, animal's status is alive
    * **effects** sets the animal’s status to 'sold', and records the date and buyer notes in notes.

  * `removeAnimal (id: ID, user: String): Empty`
    * **requires** animal exists for the given user
    * **effects** removes the animal from the set of animals
