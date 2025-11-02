---
timestamp: 'Sat Nov 01 2025 21:48:48 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251101_214848.3c1f98c7.md]]'
content_id: 57eeae4772bd8c25cf314fb74e89540c87f9406c7fd23d63ef62bd928f26c9a1
---

# concept: AnimalIdentity (Updated for Username Context)

* **purpose** allow users to represent and manage their individual animals with persistent identifiers and core attributes

* **principle**
  a user registers animals to track them individually across their lifecycle;
  assigns each animal a unique tag and records identifying details;
  updates status to reflect key transitions such as sale, death, or transfer;

* **state**
  * a set of `Animals` with
    * an `id` tag of type `ID`
    * an `owner` of type `String` (referencing the **username** of the user who registered the animal)
    * a `species` of type `String`
    * an optional `breed` of type `String`
    * a `sex` of type `Enum [male, female, neutered]`
    * a `status` of type `Enum [alive, sold, deceased, transferred]`
    * an optional `notes` of type `String`
    * an optional `birthDate` of type `Date`

* **actions**
  * `registerAnimal (ownerUsername: String, id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, notes?: String): (animal: Animal)`
    * **requires** No animal with this `id` is registered by this `ownerUsername`
    * **effects** create a new animal owned by `ownerUsername` with given attributes, status set to alive; returns the animal's ID

  * `updateStatus (ownerUsername: String, animal: Animal, status: Enum, notes: String): Empty`
    * **requires** an animal with `animal` ID owned by `ownerUsername` exists
    * **effects** set the animal’s status to the new value and record optional notes

  * `editDetails (ownerUsername: String, animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum): Empty`
    * **requires** an animal with `animal` ID owned by `ownerUsername` exists
    * **effects** update the animal’s identifying attributes

  * `markAsTransferred (ownerUsername: String, animal: AnimalID, date: Date, recipientNotes?: String): Empty`
    * **requires** an animal with `animal` ID owned by `ownerUsername` exists, animal's status is alive
    * **effects** sets the animal’s status to 'transferred', and records the date and recipient notes in notes.

  * `markAsDeceased (ownerUsername: String, animal: AnimalID, date: Date, cause?: String): Empty`
    * **requires** an animal with `animal` ID owned by `ownerUsername` exists, animal's status is alive
    * **effects** sets the animal’s status to 'deceased', and records the date and cause in notes.

  * `markAsSold (ownerUsername: String, animal: AnimalID, date: Date, buyerNotes?: String): Empty`
    * **requires** an animal with `animal` ID owned by `ownerUsername` exists, animal's status is alive
    * **effects** sets the animal’s status to 'sold', and records the date and buyer notes in notes.

  * `removeAnimal (ownerUsername: String, animal: AnimalID): Empty`
    * **requires** an animal with `animal` ID owned by `ownerUsername` exists
    * **effects** removes the animal from the set of Animals

* **queries**
  * `_getAnimal (ownerUsername: String, id: ID): (animal: AnimalDocument)`
    * **requires** an animal with `id` owned by `ownerUsername` exists
    * **effects** returns the animal document for the given ID and owner username

  * `_getAllAnimals (ownerUsername: String): (animals: AnimalDocument[])`
    * **requires** true
    * **effects** returns a list of all animal documents owned by the `ownerUsername`

***

## Update: AnimalIdentity Concept Implementation
