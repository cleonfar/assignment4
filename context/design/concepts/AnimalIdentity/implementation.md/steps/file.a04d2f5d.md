---
timestamp: 'Sat Oct 11 2025 18:02:19 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251011_180219.5f4ba3f2.md]]'
content_id: a04d2f5d70ca4daa3e51229a84d3e5c24f5a4c97f08ccb7cc6c2d89553408d4c
---

# file: src/AnimalIdentity/AnimalIdentityConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
// Assuming @utils/database.ts and @utils/types.ts are available
// import { freshID } from "@utils/database.ts"; // Not strictly needed here as Animal is external ID

/**
 * @concept AnimalIdentity
 * @purpose provide a unique and persistent identification for individual animals,
 * enabling tracking and association of attributes across different contexts.
 */
export default class AnimalIdentityConcept {
  // Declare collection prefix, use concept name
  static readonly PREFIX = "AnimalIdentity" + ".";

  // Generic type for this concept: Animal is treated as an external ID
  type Animal = ID;

  /**
   * @state
   * a set of Animals with
   *   an identityId String (unique)
   */
  interface AnimalRecord {
    _id: AnimalIdentityConcept["Animal"]; // The Animal ID itself
    identityId: string; // The unique identifier assigned to the animal
  }

  // MongoDB collection for storing animal identities
  private animals: Collection<AnimalRecord>;

  constructor(private readonly db: Db) {
    this.animals = this.db.collection(AnimalIdentityConcept.PREFIX + "animals");
  }

  /**
   * @action assignIdentity
   * @requires `animal` is not already in `Animals`
   *           AND there is no existing `Animal` `a` such that `a.identityId = identityId`
   * @effects add `animal` to `Animals` and set `animal.identityId := identityId`
   *          (returns an empty dictionary on success if no error)
   */
  async assignIdentity(
    { animal, identityId }: { animal: this["Animal"]; identityId: string },
  ): Promise<Empty | { error: string }> {
    // Check precondition 1: animal is not already in Animals
    const existingAnimalById = await this.animals.findOne({ _id: animal });
    if (existingAnimalById) {
      return { error: `Animal with ID '${animal}' already has an identity.` };
    }

    // Check precondition 2: identityId is not already used
    const existingAnimalByIdentityId = await this.animals.findOne({
      identityId: identityId,
    });
    if (existingAnimalByIdentityId) {
      return {
        error: `Identity ID '${identityId}' is already assigned to another animal.`,
      };
    }

    // Effects: add animal to Animals and set its identityId
    await this.animals.insertOne({ _id: animal, identityId: identityId });
    return {}; // Success
  }

  /**
   * @action reassignIdentity
   * @requires `animal` is in `Animals`
   *           AND there is no other `Animal` `a` (where `a != animal`) such that `a.identityId = newIdentityId`
   * @effects set `animal.identityId := newIdentityId`
   *          (returns an empty dictionary on success if no error)
   */
  async reassignIdentity(
    { animal, newIdentityId }: {
      animal: this["Animal"];
      newIdentityId: string;
    },
  ): Promise<Empty | { error: string }> {
    // Check precondition 1: animal is in Animals
    const targetAnimal = await this.animals.findOne({ _id: animal });
    if (!targetAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }

    // Check precondition 2: newIdentityId is not already used by another animal
    const conflictingAnimal = await this.animals.findOne({
      _id: { $ne: animal }, // Exclude the current animal
      identityId: newIdentityId,
    });
    if (conflictingAnimal) {
      return {
        error: `New identity ID '${newIdentityId}' is already assigned to another animal.`,
      };
    }

    // Effects: set animal.identityId := newIdentityId
    await this.animals.updateOne(
      { _id: animal },
      { $set: { identityId: newIdentityId } },
    );
    return {}; // Success
  }

  /**
   * @action revokeIdentity
   * @requires `animal` is in `Animals`
   * @effects remove `animal` from `Animals`
   *          (returns an empty dictionary on success if no error)
   */
  async revokeIdentity(
    { animal }: { animal: this["Animal"] },
  ): Promise<Empty | { error: string }> {
    // Check precondition: animal is in Animals
    const targetAnimal = await this.animals.findOne({ _id: animal });
    if (!targetAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }

    // Effects: remove animal from Animals
    await this.animals.deleteOne({ _id: animal });
    return {}; // Success
  }

  /**
   * @query _getAnimalByIdentityId
   * @effects return the `Animal` entity `a` from `Animals` where `a.identityId = identityId`, if found;
   *          otherwise return an empty result.
   */
  async _getAnimalByIdentityId(
    { identityId }: { identityId: string },
  ): Promise<{ animal?: this["Animal"] }> {
    const animalRecord = await this.animals.findOne({ identityId: identityId });
    if (animalRecord) {
      return { animal: animalRecord._id };
    }
    return {}; // Not found
  }
}
```
