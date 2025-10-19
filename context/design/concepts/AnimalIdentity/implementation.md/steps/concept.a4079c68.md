---
timestamp: 'Fri Oct 17 2025 13:15:30 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_131530.f934699e.md]]'
content_id: a4079c6816d97eb9e9b7128b7de037a7272ab1f01aeb11f0c664f7ba4c283226
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
    * **requires**
    * **effects** create a new animal with given attributes, status set to alive
  * `updateStatus (animal: Animal, status: Enum, notes: String)`
    * **requires** animal exists
    * **effects** set the animal’s status to the new value and record optional notes
  * `editDetails (animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum)`
    * **requires** animal exists
    * **effects** update the animal’s identifying attributes
  * `viewAnimal (id: ID): (animal: Animal)`
    * **requires** an animal with this id exists
    * **effects** return the animal and its attributes
  * `getBirthDate (id: ID): (birthdate: Date)`
    * **requires** an animal with this id exists
    * **effects** return the birthdate of this animal
  * `getMother (id: ID): (mother: ID)`
    * **requires**: an animal with this id exists and has a known mother
    * **effects**: return the id of the mother of the animal
  * `getFather (id: ID): (Father: ID)`
    * **requires**: an animal with this id exists and has a known father
    * **effects**: return the father of the animal
  * `getOffspring (id: ID): (offspring: (set of ID))`
    * **requires**: an animal with this id exists and has offspring
    * **effects**: return the father of the animal
  * `getBreed (id: ID): (breed: String)`
    * **requires**: an animal with this id exists
    * **effects**: return the father of the animal
  * `getSex (id: ID): (sex: Enum [male, female, neutered])`
    * **requires**: an animal with this id exists
    * **effects**: return the sex of the animal
  * `getStatus (id: ID): (sex: Enum [alive, deceased, sold])`
    * **requires**: an animal with this id exists
    * **effects**: return the status of the animal
