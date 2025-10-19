---
timestamp: 'Sat Oct 11 2025 18:01:06 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251011_180106.a230ed10.md]]'
content_id: f12f7834c20e791343b44f3d3561dd9105c9bdd12209a7e86381516585243d6c
---

# file: src/AnimalIdentity/AnimalIdentityConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
// freshID is not directly used here as the Entity ID serves as the MongoDB _id

// Declare collection prefix, use concept name
const PREFIX = "AnimalIdentity" + ".";

/**
 * Type parameter for the entity being identified as an animal.
 * This concept treats it polymorphically, only caring about its ID.
 */
type Entity = ID;

/**
 * Interface representing an animal document stored in the MongoDB collection.
 * The `_id` field is the `Entity` ID itself, making the entity
 * the primary key within this concept's state.
 *
 * **state**
 *   a set of Animals with
 *     an entity Entity
 *     a name String
 */
interface AnimalDoc {
  _id: Entity; // The entity ID serves as the animal's unique identifier within this concept
  name: string;
}

/**
 * **concept** AnimalIdentity [Entity]
 *
 * **purpose** establish an entity as an animal and associate a name with it,
 * providing a unique identity within the concept's scope and allowing for name management.
 */
export default class AnimalIdentityConcept {
  private animals: Collection<AnimalDoc>;

  constructor(private readonly db: Db) {
    // Initialize the MongoDB collection for animals
    this.animals = this.db.collection(PREFIX + "animals");
  }

  /**
   * **action** createAnimal (entity: Entity, name: String): (animal: Entity | error: String)
   *
   * **requires** the entity is not already an animal; the name is not empty
   * **effects** a new animal is recorded, associating the given entity (which becomes the animal's identifier)
   *            with the provided name. The entity's ID is returned as the animal's ID.
   *
   * @param {object} args - The arguments for the action.
   * @param {Entity} args.entity - The ID of the entity to be registered as an animal.
   * @param {string} args.name - The name to assign to the new animal.
   * @returns {Promise<{ animal: Entity } | { error: string }>} An object containing the animal's ID on success,
   *                                                             or an error message if creation fails.
   */
  async createAnimal({ entity, name }: { entity: Entity; name: string }): Promise<{ animal: Entity } | { error: string }> {
    if (!name || name.trim() === "") {
      return { error: "Animal name cannot be empty." };
    }

    // Check if an animal with this entity ID already exists
    const existingAnimal = await this.animals.findOne({ _id: entity });
    if (existingAnimal) {
      return { error: `Entity '${entity}' is already an animal.` };
    }

    const newAnimal: AnimalDoc = {
      _id: entity, // Use the provided entity ID as the document's _id
      name: name.trim(),
    };

    try {
      await this.animals.insertOne(newAnimal);
      return { animal: entity };
    } catch (e) {
      // Catch potential database errors (e.g., unique key violation, though checked above)
      return { error: `Failed to create animal for entity '${entity}': ${e.message}` };
    }
  }

  /**
   * **action** renameAnimal (entity: Entity, newName: String): (Empty | error: String)
   *
   * **requires** the entity is an animal; the new name is not empty
   * **effects** the animal associated with the given entity has its name updated to `newName`.
   *
   * @param {object} args - The arguments for the action.
   * @param {Entity} args.entity - The ID of the animal entity to rename.
   * @param {string} args.newName - The new name for the animal.
   * @returns {Promise<Empty | { error: string }>} An empty object on success, or an error message if renaming fails.
   */
  async renameAnimal({ entity, newName }: { entity: Entity; newName: string }): Promise<Empty | { error: string }> {
    if (!newName || newName.trim() === "") {
      return { error: "New animal name cannot be empty." };
    }

    const result = await this.animals.updateOne(
      { _id: entity }, // Find the animal by its entity ID
      { $set: { name: newName.trim() } }, // Set the new name
    );

    if (result.matchedCount === 0) {
      // If no document was matched, the entity was not found as an animal
      return { error: `Entity '${entity}' is not an animal.` };
    }

    return {}; // Success, return an empty object
  }

  /**
   * **query** _getAnimalName (entity: Entity): (name: String)
   *
   * **effects** returns the name of the animal associated with the entity.
   *            If the entity is not an animal, an empty string is returned.
   *
   * @param {object} args - The arguments for the query.
   * @param {Entity} args.entity - The ID of the entity to query.
   * @returns {Promise<string>} The name of the animal, or an empty string if not found.
   */
  async _getAnimalName({ entity }: { entity: Entity }): Promise<string> {
    const animal = await this.animals.findOne({ _id: entity });
    return animal ? animal.name : ""; // Return name or empty string if not found
  }
}
```
