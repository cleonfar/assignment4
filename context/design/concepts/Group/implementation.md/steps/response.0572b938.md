---
timestamp: 'Mon Oct 13 2025 13:09:18 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_130918.c8ec41d5.md]]'
content_id: 0572b9380b112b3ff740e3042133d6b3e128c300ba7ad22d47f45f621b0a0d14
---

# response:

```typescript
// file: src/HerdGrouping/HerdGroupingConcept.ts
import { Collection, Db, ObjectId } from "npm:mongodb";

// --- Simulate @utils/types.ts and @utils/database.ts as per prompt ---
// In a real project, these would be imported from the actual utility files.
export type ID = string & { __brand: "ID" };
export type Empty = Record<PropertyKey, never>;

export function freshID(): ID {
  // Use crypto.randomUUID for generating unique string IDs
  return crypto.randomUUID() as ID;
}
// --- End simulation ---


// Declare collection prefix, use concept name
const PREFIX = "HerdGrouping" + ".";

// Generic types of this concept, defined as branded IDs
type User = ID;
type Animal = ID;
type Herd = ID;

/**
 * Represents a herd group within the HerdGrouping concept.
 *
 * Corresponds to the 'state' section:
 * a set of `groups` with
 *   a `name` of type `String`
 *   a `location` of type `String` (chosen over 'description' from spec, aligning with `createHerd` action)
 *   an `owner` of type `User` (added based on `createHerd` action parameters)
 *   a set of `animals` of type `ID`
 *   an `isArchived` flag of type `boolean` (added to support 'mergeHerds' action)
 */
interface GroupDoc {
  _id: Herd; // The unique identifier for the herd
  owner: User; // The user who created or owns this herd
  name: string; // A descriptive name for the herd
  location: string; // The physical or logical location associated with the herd
  animals: Animal[]; // An array of animal IDs belonging to this herd
  isArchived: boolean; // True if the herd is inactive (e.g., after a merge)
}

/**
 * # concept: HerdGrouping
 *
 * **purpose** organize animals into dynamic groupings for operational and analytical purposes
 *
 * **principle**
 *   a user creates herds to group animals based on location, purpose, or management strategy;
 *   adds or removes animals from herds as conditions change;
 *   merges herds when combining groups, or splits them to separate animals;
 *   moves animals between herds to reflect real-world transitions;
 *   and views herd composition and history to support planning and analysis.
 */
export default class HerdGroupingConcept {
  // MongoDB collection for storing herd groups
  groups: Collection<GroupDoc>;

  /**
   * Constructs the HerdGroupingConcept, initializing its MongoDB collection.
   * @param db The MongoDB database instance.
   */
  constructor(private readonly db: Db) {
    this.groups = this.db.collection(PREFIX + "groups");
  }

  /**
   * **action** createHerd (owner: User, name: String, location: String): (herd: Herd)
   *
   * **effects** create a new herd with this owner, name, location, and no members.
   *            The new herd is initially active (not archived).
   * @param {object} args - The arguments for the action.
   * @param {User} args.owner - The ID of the user creating the herd.
   * @param {string} args.name - The name of the new herd.
   * @param {string} args.location - The location associated with the herd.
   * @returns {Promise<{herd: Herd}>} - The ID of the newly created herd.
   */
  async createHerd(
    { owner, name, location }: { owner: User; name: string; location: string },
  ): Promise<{ herd: Herd }> {
    const newHerdId = freshID();
    const newHerd: GroupDoc = {
      _id: newHerdId,
      owner,
      name,
      location,
      animals: [],
      isArchived: false,
    };
    await this.groups.insertOne(newHerd);
    return { herd: newHerdId };
  }

  /**
   * **action** addAnimal (herd: Herd, animal: Animal)
   *
   * **requires** herd exists and is not archived. Animal's existence is external to this concept.
   * **effects** add the animal to the specified herd. If the animal is already a member,
   *            the action is idempotent and the state remains unchanged for that animal.
   * @param {object} args - The arguments for the action.
   * @param {Herd} args.herd - The ID of the herd to add the animal to.
   * @param {Animal} args.animal - The ID of the animal to add.
   * @returns {Promise<Empty | {error: string}>} - An empty object on success, or an error message.
   */
  async addAnimal(
    { herd, animal }: { herd: Herd; animal: Animal },
  ): Promise<Empty | { error: string }> {
    const result = await this.groups.updateOne(
      { _id: herd, isArchived: false },
      { $addToSet: { animals: animal } }, // $addToSet prevents duplicates
    );

    if (result.matchedCount === 0) {
      // Check if herd exists but is archived, for a more specific error
      const existingHerd = await this.groups.findOne({ _id: herd });
      if (existingHerd && existingHerd.isArchived) {
        return { error: `Herd '${herd}' is archived and cannot be modified.` };
      }
      return { error: `Herd '${herd}' not found.` };
    }
    return {};
  }

  /**
   * **action** removeAnimal (herd: Herd, animal: Animal)
   *
   * **requires** herd exists, is not archived, and animal is a member of the herd.
   * **effects** remove the animal from the specified herd.
   * @param {object} args - The arguments for the action.
   * @param {Herd} args.herd - The ID of the herd to remove the animal from.
   * @param {Animal} args.animal - The ID of the animal to remove.
   * @returns {Promise<Empty | {error: string}>} - An empty object on success, or an error message.
   */
  async removeAnimal(
    { herd, animal }: { herd: Herd; animal: Animal },
  ): Promise<Empty | { error: string }> {
    const existingHerd = await this.groups.findOne({ _id: herd });
    if (!existingHerd) {
      return { error: `Herd '${herd}' not found.` };
    }
    if (existingHerd.isArchived) {
      return { error: `Herd '${herd}' is archived and cannot be modified.` };
    }
    if (!existingHerd.animals.includes(animal)) {
      return { error: `Animal '${animal}' is not a member of herd '${herd}'.` };
    }

    await this.groups.updateOne(
      { _id: herd },
      { $pull: { animals: animal } },
    );
    return {};
  }

  /**
   * **action** moveAnimal (source: Herd, target: Herd, animal: Animal)
   *
   * **requires** both source and target herds exist and are not archived.
   *            The animal must be a member of the source herd. Source and target herds must be different.
   * **effects** remove the animal from the source herd and add it to the target herd.
   * @param {object} args - The arguments for the action.
   * @param {Herd} args.source - The ID of the herd to move the animal from.
   * @param {Herd} args.target - The ID of the herd to move the animal to.
   * @param {Animal} args.animal - The ID of the animal to move.
   * @returns {Promise<Empty | {error: string}>} - An empty object on success, or an error message.
   */
  async moveAnimal(
    { source, target, animal }: { source: Herd; target: Herd; animal: Animal },
  ): Promise<Empty | { error: string }> {
    if (source === target) {
      return { error: "Source and target herds cannot be the same for moving an animal." };
    }

    const sourceHerd = await this.groups.findOne({ _id: source });
    const targetHerd = await this.groups.findOne({ _id: target });

    if (!sourceHerd) {
      return { error: `Source herd '${source}' not found.` };
    }
    if (sourceHerd.isArchived) {
      return { error: `Source herd '${source}' is archived and cannot be modified.` };
    }
    if (!targetHerd) {
      return { error: `Target herd '${target}' not found.` };
    }
    if (targetHerd.isArchived) {
      return { error: `Target herd '${target}' is archived and cannot be modified.` };
    }

    if (!sourceHerd.animals.includes(animal)) {
      return { error: `Animal '${animal}' is not a member of source herd '${source}'.` };
    }

    // Use a transaction for atomicity in a production environment
    // For this example, we perform two separate updates
    const removeResult = await this.groups.updateOne(
      { _id: source },
      { $pull: { animals: animal } },
    );
    const addResult = await this.groups.updateOne(
      { _id: target },
      { $addToSet: { animals: animal } }, // Use $addToSet to avoid duplicates if animal already exists in target
    );

    // Defensive check to ensure updates occurred, though preconditions should prevent issues
    if (removeResult.modifiedCount === 0 || addResult.modifiedCount === 0) {
      return { error: "Failed to move animal due to an unexpected state or race condition." };
    }

    return {};
  }

  /**
   * **action** mergeHerds (source: Herd, target: Herd)
   *
   * **requires** both source and target herds exist and are not archived. Source and target herds must be different.
   * **effects** move all animals from the source herd to the target herd.
   *            The source herd is then archived (marked inactive and its animals cleared).
   *            The target herd remains active and contains the combined animals.
   *            (Interpretation: "archive source and target herd" from spec refers to retiring the source herd after merge,
   *            with the target remaining as the active combined group, consistent with "combining groups".)
   * @param {object} args - The arguments for the action.
   * @param {Herd} args.source - The ID of the herd whose animals will be moved and which will be archived.
   * @param {Herd} args.target - The ID of the herd that will receive the animals and remain active.
   * @returns {Promise<Empty | {error: string}>} - An empty object on success, or an error message.
   */
  async mergeHerds(
    { source, target }: { source: Herd; target: Herd },
  ): Promise<Empty | { error: string }> {
    if (source === target) {
      return { error: "Source and target herds cannot be the same for merging." };
    }

    const sourceHerd = await this.groups.findOne({ _id: source });
    const targetHerd = await this.groups.findOne({ _id: target });

    if (!sourceHerd) {
      return { error: `Source herd '${source}' not found.` };
    }
    if (sourceHerd.isArchived) {
      return { error: `Source herd '${source}' is already archived.` };
    }
    if (!targetHerd) {
      return { error: `Target herd '${target}' not found.` };
    }
    if (targetHerd.isArchived) {
      return { error: `Target herd '${target}' is archived and cannot be merged into.` };
    }

    const animalsToMove = sourceHerd.animals;

    // Add animals from source to target, using $addToSet with $each for array elements
    await this.groups.updateOne(
      { _id: target },
      { $addToSet: { animals: { $each: animalsToMove } } },
    );

    // Archive the source herd: mark as archived and clear its animals
    await this.groups.updateOne(
      { _id: source },
      { $set: { isArchived: true, animals: [] } },
    );

    return {};
  }

  /**
   * **action** splitHerd (source: Herd, target: Herd, animals: Set<Animal>)
   *
   * **requires** both source and target herds exist and are not archived.
   *            All specified animals must be members of the source herd. Source and target herds must be different.
   * **effects** move the specified subset of animals from the source herd to the target herd.
   * @param {object} args - The arguments for the action.
   * @param {Herd} args.source - The ID of the herd to split animals from.
   * @param {Herd} args.target - The ID of the herd to move animals to.
   * @param {Animal[]} args.animals - An array of animal IDs to move from source to target.
   * @returns {Promise<Empty | {error: string}>} - An empty object on success, or an error message.
   */
  async splitHerd(
    { source, target, animals }: { source: Herd; target: Herd; animals: Animal[] },
  ): Promise<Empty | { error: string }> {
    if (source === target) {
      return { error: "Source and target herds cannot be the same for splitting." };
    }

    const sourceHerd = await this.groups.findOne({ _id: source });
    const targetHerd = await this.groups.findOne({ _id: target });

    if (!sourceHerd) {
      return { error: `Source herd '${source}' not found.` };
    }
    if (sourceHerd.isArchived) {
      return { error: `Source herd '${source}' is archived and cannot be modified.` };
    }
    if (!targetHerd) {
      return { error: `Target herd '${target}' not found.` };
    }
    if (targetHerd.isArchived) {
      return { error: `Target herd '${target}' is archived and cannot be modified.` };
    }

    const animalsInSource = new Set(sourceHerd.animals);
    const animalsToSplitSet = new Set(animals);

    // Check if all specified animals are indeed members of the source herd
    for (const animal of animalsToSplitSet) {
      if (!animalsInSource.has(animal)) {
        return {
          error:
            `Animal '${animal}' specified for split is not a member of source herd '${source}'.`,
        };
      }
    }

    // Convert Set back to Array for MongoDB operations if necessary
    const animalsToPull = Array.from(animalsToSplitSet);

    // Remove animals from source herd
    await this.groups.updateOne(
      { _id: source },
      { $pullAll: { animals: animalsToPull } },
    );

    // Add animals to target herd, using $addToSet with $each
    await this.groups.updateOne(
      { _id: target },
      { $addToSet: { animals: { $each: animalsToPull } } },
    );

    return {};
  }

  /**
   * **query** _viewComposition (herd: Herd): (animals: Set<Animal>)
   *
   * **requires** herd exists and is not archived.
   * **effects** return current members of the herd.
   * @param {object} args - The arguments for the query.
   * @param {Herd} args.herd - The ID of the herd whose composition is to be viewed.
   * @returns {Promise<{animals: Animal[]} | {error: string}>} - An object containing the list of animal IDs, or an error message.
   */
  async _viewComposition(
    { herd }: { herd: Herd },
  ): Promise<{ animals: Animal[] } | { error: string }> {
    const existingHerd = await this.groups.findOne({ _id: herd, isArchived: false });
    if (!existingHerd) {
      // Provide a more specific error if the herd is found but archived
      const archivedHerd = await this.groups.findOne({ _id: herd, isArchived: true });
      if (archivedHerd) {
        return { error: `Herd '${herd}' is archived and its composition cannot be viewed.` };
      }
      return { error: `Herd '${herd}' not found.` };
    }
    return { animals: existingHerd.animals };
  }
}
```
