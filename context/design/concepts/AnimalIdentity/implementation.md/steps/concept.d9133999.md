---
timestamp: 'Sat Oct 11 2025 18:01:06 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251011_180106.a230ed10.md]]'
content_id: d91339996ddabd7eefbac327b9d4c7b936a8cbb6f4319b168beb986b057b6744
---

# concept: AnimalIdentity

**concept** AnimalIdentity \[Entity]

**purpose** establish an entity as an animal and associate a name with it, providing a unique identity within the concept's scope and allowing for name management.

**principle** If an entity is designated as an animal with a given name, then its name can be reliably retrieved, and its name can be updated later without affecting its identity as an animal.

**state**
  a set of Animals with
    an entity Entity
    a name String

**actions**
  createAnimal (entity: Entity, name: String): (animal: Entity)
    **requires** the entity is not already an animal; the name is not empty
    **effects** a new animal is recorded, associating the given entity (which becomes the animal's identifier) with the provided name. The entity's ID is returned as the animal's ID.

  renameAnimal (entity: Entity, newName: String)
    **requires** the entity is an animal; the new name is not empty
    **effects** the animal associated with the given entity has its name updated to `newName`.

**queries**
  \_getAnimalName (entity: Entity): (name: String)
    **effects** returns the name of the animal associated with the entity. If the entity is not an animal, an empty string is returned.

***
