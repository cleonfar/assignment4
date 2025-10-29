---
timestamp: 'Mon Oct 27 2025 13:28:20 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251027_132820.e0f3ffdb.md]]'
content_id: 0f874955c6153624a43a11816efab07ba9fec63f188bfe15136cc6f23e597a73
---

# concept: AnimalIdentity (Updated for User Context)

* **purpose** allow users to represent and manage their individual animals with persistent identifiers and core attributes

* **principle**
  a user registers animals to track them individually across their lifecycle;
  assigns each animal a unique tag and records identifying details;
  updates status to reflect key transitions such as sale, death, or transfer;

* **state**
  * a set of `Animals` with
    * an `id` tag of type `ID`
    * an `owner` of type `ID` (referencing the user who registered the animal)
    * a `species` of type `String`
    * an optional `breed` of type `String`
    * a `sex` of type `Enum [male, female, neutered]`
    * a `status` of type `Enum [alive, sold, deceased, transferred]`
    * an optional `notes` of type `String`
    * an optional `birthDate` of type `Date`

* **actions**
  * `registerAnimal (user: ID, id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, notes?: String): (animal: Animal)`
    * **requires** No animal with this `id` is registered by this `user`
    * **effects** create a new animal owned by `user` with given attributes, status set to alive; returns the animal's ID

  * `updateStatus (user: ID, animal: Animal, status: Enum, notes: String): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists
    * **effects** set the animal’s status to the new value and record optional notes

  * `editDetails (user: ID, animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists
    * **effects** update the animal’s identifying attributes

  * `markAsTransferred (user: ID, animal: AnimalID, date: Date, recipientNotes?: String): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists, animal's status is alive
    * **effects** sets the animal’s status to 'transferred', and records the date and recipient notes in notes.

  * `markAsDeceased (user: ID, animal: AnimalID, date: Date, cause?: String): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists, animal's status is alive
    * **effects** sets the animal’s status to 'deceased', and records the date and cause in notes.

  * `markAsSold (user: ID, animal: AnimalID, date: Date, buyerNotes?: String): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists, animal's status is alive
    * **effects** sets the animal’s status to 'sold', and records the date and buyer notes in notes.

  * `removeAnimal (user: ID, animal: AnimalID): Empty`
    * **requires** an animal with `animal` ID owned by `user` exists
    * **effects** removes the animal from the set of Animals

* **queries**
  * `_getAnimal (user: ID, id: ID): (animal: AnimalDocument)`
    * **requires** an animal with `id` owned by `user` exists
    * **effects** returns the animal document for the given ID and user

  * `_getAllAnimals (user: ID): (animals: AnimalDocument[])`
    * **requires** true
    * **effects** returns a list of all animal documents owned by the `user`

***
