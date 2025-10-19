---
timestamp: 'Fri Oct 17 2025 22:15:40 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_221540.ad93ed7b.md]]'
content_id: b9e00f053cb9020f2c95b26b98e27ab1b12776b888d8e1f47ede56fe8f49603f
---

# file: src/HerdGrouping/HerdGroupingConcept.ts (Updated for Lenient Move/Split)

```typescript
import { Collection, Db, MongoClient } from "npm:mongodb"; // Import MongoClient
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "HerdGrouping" + ".";

// Generic types of this concept
type Animal = ID; // Animal IDs are external, generic IDs

/**
 * a set of `groups` with
 *   a `name` of type `String` (unique, serves as identifier `_id`)
 *   an optional `description` of type `String`
 *   a `members` set of `Animal` IDs
 *   a `isArchived` Boolean (default false)
 */
interface Herd {
  _id: string; // Herd name serves as the unique ID
  name: string; // Redundant but good for clarity, matches _id
  description?: string;
  members: Animal[];
  isArchived: boolean;
}

export default class HerdGroupingConcept {
  groups: Collection<Herd>;

  // Accept and store the MongoClient instance for transactions
  constructor(private readonly db: Db, private readonly client: MongoClient) {
    this.groups = this.db.collection<Herd>(PREFIX + "groups");
  }

  /**
   * createHerd (name: String, description?: String): ({herdName: String} | {error: String})
   * requires a herd with `name` does not already exist.
   * effects create a new herd with this `name`, optional `description`, `isArchived: false`, and an empty set of `members`. Return the `herdName`.
   */
  async createHerd(
    { name, description }: { name: string; description?: string },
  ): Promise<{ herdName: string } | { error: string }> {
    if (!name || name.trim() === "") {
      return { error: "Herd name cannot be empty." };
    }

    const existingHerd = await this.groups.findOne({ _id: name });
    if (existingHerd) {
      return { error: `Herd '${name}' already exists.` };
    }

    const newHerd: Herd = {
      _id: name,
      name: name,
      description: description,
      members: [],
      isArchived: false,
    };

    await this.groups.insertOne(newHerd);
    return { herdName: name };
  }

  /**
   * addAnimal (herdName: String, animal: Animal): Empty | {error: String}
   * requires a herd with `herdName` exists, is not archived, and `animal` is *not* already a member of the herd.
   * effects add the `animal` to the `members` of the specified `herd`.
   */
  async addAnimal(
    { herdName, animal }: { herdName: string; animal: Animal },
  ): Promise<Empty | { error: string }> {
    const herd = await this.groups.findOne({ _id: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found.` };
    }
    if (herd.isArchived) {
      return { error: `Herd '${herdName}' is archived and cannot be modified.` };
    }
    if (herd.members.includes(animal)) {
      return { error: `Animal '${animal}' is already a member of herd '${herdName}'.` };
    }

    await this.groups.updateOne(
      { _id: herdName },
      { $addToSet: { members: animal } }, // $addToSet ensures uniqueness
    );
    return {};
  }

  /**
   * removeAnimal (herdName: String, animal: Animal): Empty | {error: String}
   * requires a herd with `herdName` exists, is not archived, and `animal` is a member of the herd.
   * effects remove the `animal` from the `members` of the specified `herd`.
   */
  async removeAnimal(
    { herdName, animal }: { herdName: string; animal: Animal },
  ): Promise<Empty | { error: string }> {
    const herd = await this.groups.findOne({ _id: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found.` };
    }
    if (herd.isArchived) {
      return { error: `Herd '${herdName}' is archived and cannot be modified.` };
    }
    if (!herd.members.includes(animal)) {
      return { error: `Animal '${animal}' is not a member of herd '${herdName}'.` };
    }

    await this.groups.updateOne(
      { _id: herdName },
      { $pull: { members: animal } },
    );
    return {};
  }

  /**
   * moveAnimal (sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}
   * requires `sourceHerd` and `targetHerd` exist, are not archived, and `animal` is a member of `sourceHerd`.
   * effects remove `animal` from `sourceHerd` and ensure it is a member of `targetHerd`.
   */
  async moveAnimal(
    { sourceHerdName, targetHerdName, animal }: {
      sourceHerdName: string;
      targetHerdName: string;
      animal: Animal;
    },
  ): Promise<Empty | { error: string }> {
    if (sourceHerdName === targetHerdName) {
      return { error: "Source and target herds cannot be the same for moving an animal." };
    }

    const sourceHerd = await this.groups.findOne({ _id: sourceHerdName });
    const targetHerd = await this.groups.findOne({ _id: targetHerdName });

    if (!sourceHerd) {
      return { error: `Source herd '${sourceHerdName}' not found.` };
    }
    if (sourceHerd.isArchived) {
      return { error: `Source herd '${sourceHerdName}' is archived.` };
    }
    if (!targetHerd) {
      return { error: `Target herd '${targetHerdName}' not found.` };
    }
    if (targetHerd.isArchived) {
      return { error: `Target herd '${targetHerdName}' is archived.` };
    }
    if (!sourceHerd.members.includes(animal)) {
      return { error: `Animal '${animal}' is not a member of source herd '${sourceHerdName}'.` };
    }

    // The check for `animal` being in `targetHerd.members` is removed here.
    // MongoDB's $addToSet will ensure no duplicates in the target.

    const session = this.client.startSession();
    session.startTransaction();
    try {
      await this.groups.updateOne(
        { _id: sourceHerdName },
        { $pull: { members: animal } },
        { session },
      );
      // $addToSet will add the animal to targetHerd only if it's not already there.
      await this.groups.updateOne(
        { _id: targetHerdName },
        { $addToSet: { members: animal } },
        { session },
      );
      await session.commitTransaction();
      return {};
    } catch (e) {
      await session.abortTransaction();
      console.error("Transaction failed during moveAnimal:", e);
      return { error: "Failed to move animal due to a database error." };
    } finally {
      await session.endSession();
    }
  }

  /**
   * mergeHerds (herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}
   * requires `herdNameToKeep` and `herdNameToArchive` exist, are not archived, and `herdNameToKeep` is not the same as `herdNameToArchive`.
   * effects move all animals from `herdNameToArchive` to `herdNameToKeep`. Mark `herdNameToArchive` as `isArchived: true`.
   */
  async mergeHerds(
    { herdNameToKeep, herdNameToArchive }: {
      herdNameToKeep: string;
      herdNameToArchive: string;
    },
  ): Promise<Empty | { error: string }> {
    if (herdNameToKeep === herdNameToArchive) {
      return { error: "Cannot merge a herd into itself." };
    }

    const herdToKeep = await this.groups.findOne({ _id: herdNameToKeep });
    const herdToArchive = await this.groups.findOne({ _id: herdNameToArchive });

    if (!herdToKeep) {
      return { error: `Herd '${herdNameToKeep}' not found.` };
    }
    if (herdToKeep.isArchived) {
      return { error: `Herd '${herdNameToKeep}' is archived.` };
    }
    if (!herdToArchive) {
      return { error: `Herd '${herdNameToArchive}' not found.` };
    }
    if (herdToArchive.isArchived) {
      return { error: `Herd '${herdNameToArchive}' is already archived.` };
    }

    const animalsToMove = herdToArchive.members;

    const session = this.client.startSession();
    session.startTransaction();
    try {
      // Add all animals from herdToArchive to herdToKeep (using $addToSet to avoid duplicates)
      if (animalsToMove.length > 0) {
        await this.groups.updateOne(
          { _id: herdNameToKeep },
          { $addToSet: { members: { $each: animalsToMove } } },
          { session },
        );
      }

      // Archive herdToArchive
      await this.groups.updateOne(
        { _id: herdNameToArchive },
        { $set: { isArchived: true, members: [] } }, // Clear members in archived herd too
        { session },
      );

      await session.commitTransaction();
      return {};
    } catch (e) {
      await session.abortTransaction();
      console.error("Transaction failed during mergeHerds:", e);
      return { error: "Failed to merge herds due to a database error." };
    } finally {
      await session.endSession();
    }
  }

  /**
   * splitHerd (sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}
   * requires `sourceHerd` and `targetHerd` exist, are not archived, and all `animalsToMove` are members of `sourceHerd`.
   * effects move specified `animalsToMove` from `sourceHerd` to `targetHerd`.
   */
  async splitHerd(
    { sourceHerdName, targetHerdName, animalsToMove }: {
      sourceHerdName: string;
      targetHerdName: string;
      animalsToMove: Animal[];
    },
  ): Promise<Empty | { error: string }> {
    if (sourceHerdName === targetHerdName) {
      return { error: "Source and target herds cannot be the same for splitting." };
    }
    if (!animalsToMove || animalsToMove.length === 0) {
      return { error: "No animals specified to move for splitting." };
    }

    const sourceHerd = await this.groups.findOne({ _id: sourceHerdName });
    const targetHerd = await this.groups.findOne({ _id: targetHerdName });

    if (!sourceHerd) {
      return { error: `Source herd '${sourceHerdName}' not found.` };
    }
    if (sourceHerd.isArchived) {
      return { error: `Source herd '${sourceHerdName}' is archived.` };
    }
    if (!targetHerd) {
      return { error: `Target herd '${targetHerdName}' not found.` };
    }
    if (targetHerd.isArchived) {
      return { error: `Target herd '${targetHerdName}' is archived.` };
    }

    // Check precondition: all animalsToMove must be in the source herd
    const missingInSource = animalsToMove.filter((animal) => !sourceHerd.members.includes(animal));
    if (missingInSource.length > 0) {
      return {
        error: `Animals ${
          missingInSource.join(", ")
        } are not members of the source herd '${sourceHerdName}'.`,
      };
    }

    // The check for `animalsToMove` being in `targetHerd.members` is removed here.
    // MongoDB's $addToSet with $each will ensure no duplicates in the target.

    const session = this.client.startSession();
    session.startTransaction();
    try {
      // Remove from source herd
      await this.groups.updateOne(
        { _id: sourceHerdName },
        { $pullAll: { members: animalsToMove } },
        { session },
      );

      // Add to target herd ($addToSet with $each will handle duplicates gracefully)
      await this.groups.updateOne(
        { _id: targetHerdName },
        { $addToSet: { members: { $each: animalsToMove } } },
        { session },
      );

      await session.commitTransaction();
      return {};
    } catch (e) {
      await session.abortTransaction();
      console.error("Transaction failed during splitHerd:", e);
      return { error: "Failed to split herd due to a database error." };
    } finally {
      await session.endSession();
    }
  }

  /**
   * _viewComposition (herdName: String): ({animals: Array<Animal>} | {error: String})
   * requires a herd with `herdName` exists.
   * effects return the current members of the `herd`.
   */
  async _viewComposition(
    { herdName }: { herdName: string },
  ): Promise<{ animals: Animal[] } | { error: string }> {
    const herd = await this.groups.findOne({ _id: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found.` };
    }

    return { animals: herd.members };
  }

  /**
   * _listHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
   * effects return a list of all herds with their names, descriptions, and archived status.
   */
  async _listHerds(): Promise<{ herds: Array<{ name: string; description?: string; isArchived: boolean }> }> {
    const herds = await this.groups.find({}, {
      projection: { _id: 0, name: 1, description: 1, isArchived: 1 },
    }).toArray();
    return { herds: herds };
  }
}
```

***

### Updated Tests

The tests for `moveAnimal` and `splitHerd` are updated to assert that the actions *succeed* (do not return an error) even when some animals are already in the target herd, and that the final state correctly reflects the unique presence of these animals in the target herd.
