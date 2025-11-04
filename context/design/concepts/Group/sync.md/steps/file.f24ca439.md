---
timestamp: 'Sun Nov 02 2025 16:03:24 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_160324.74adff65.md]]'
content_id: f24ca439414431e82971f0130dd2419eba25704704da1097432bb91183df9847
---

# file: src/HerdGrouping/HerdGroupingConcept.ts (Updated)

```typescript
import { Collection, Db, MongoClient } from "npm:mongodb";
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
      return {
        error: `Herd '${herdName}' is archived and cannot be modified.`,
      };
    }
    if (herd.members.includes(animal)) {
      return {
        error: `Animal '${animal}' is already a member of herd '${herdName}'.`,
      };
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
      return {
        error: `Herd '${herdName}' is archived and cannot be modified.`,
      };
    }
    if (!herd.members.includes(animal)) {
      return {
        error: `Animal '${animal}' is not a member of herd '${herdName}'.`,
      };
    }

    await this.groups.updateOne(
      { _id: herdName },
      { $pull: { members: animal } },
    );
    return {};
  }

  /**
   * moveAnimal (sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}
   * requires `sourceHerd` and `targetHerd` exist, are not archived, `animal` is a member of `sourceHerd`.
   * effects remove `animal` from `sourceHerd` and add it to `targetHerd` (if not already present).
   */
  async moveAnimal(
    { sourceHerdName, targetHerdName, animal }: {
      sourceHerdName: string;
      targetHerdName: string;
      animal: Animal;
    },
  ): Promise<Empty | { error: string }> {
    if (sourceHerdName === targetHerdName) {
      return {
        error:
          "Source and target herds cannot be the same for moving an animal.",
      };
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
      return {
        error:
          `Animal '${animal}' is not a member of source herd '${sourceHerdName}'.`,
      };
    }

    // Atomically update both herds
    const session = this.client.startSession();
    session.startTransaction();
    try {
      await this.groups.updateOne(
        { _id: sourceHerdName },
        { $pull: { members: animal } },
        { session },
      );
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
   * requires `sourceHerd` exists and is not archived. All `animalsToMove` are members of `sourceHerd`. If `targetHerd` already exists, it must not be archived.
   * effects If `targetHerdName` does not exist, a new unarchived herd with that `name` and an empty `description` is created. Then, the specified `animalsToMove` are removed from `sourceHerd` and added to `targetHerd` (if not already present).
   */
  async splitHerd(
    { sourceHerdName, targetHerdName, animalsToMove }: {
      sourceHerdName: string;
      targetHerdName: string;
      animalsToMove: Animal[];
    },
  ): Promise<Empty | { error: string }> {
    if (sourceHerdName === targetHerdName) {
      return {
        error: "Source and target herds cannot be the same for splitting.",
      };
    }
    if (!animalsToMove || animalsToMove.length === 0) {
      return { error: "No animals specified to move for splitting." };
    }

    const sourceHerd = await this.groups.findOne({ _id: sourceHerdName });
    if (!sourceHerd) {
      return { error: `Source herd '${sourceHerdName}' not found.` };
    }
    if (sourceHerd.isArchived) {
      return { error: `Source herd '${sourceHerdName}' is archived.` };
    }

    // Check precondition: all animalsToMove are members of sourceHerd
    const missingInSource = animalsToMove.filter((animal) =>
      !sourceHerd.members.includes(animal)
    );
    if (missingInSource.length > 0) {
      return {
        error: `Animals ${
          missingInSource.join(", ")
        } are not members of the source herd '${sourceHerdName}'.`,
      };
    }

    let targetHerd = await this.groups.findOne({ _id: targetHerdName });

    // If target herd does not exist, create it
    if (!targetHerd) {
      const createResult = await this.createHerd({ name: targetHerdName });
      if ("error" in createResult) {
        // If creation fails for some reason (e.g., validation in createHerd), return that error
        return {
          error:
            `Failed to create target herd '${targetHerdName}': ${createResult.error}`,
        };
      }
      // Re-fetch targetHerd to ensure its state is fully updated if it was just created,
      // especially important if createHerd had more complex internal logic or defaults.
      // For this specific createHerd implementation, it's not strictly necessary to refetch
      // as we know its initial state, but it's safer for more complex scenarios.
      targetHerd = await this.groups.findOne({ _id: targetHerdName });
      if (!targetHerd) { // Should not happen if createHerd succeeded
        return { error: `Internal error: newly created target herd '${targetHerdName}' not found.` };
      }
    } else if (targetHerd.isArchived) {
      // If target herd exists but is archived, it cannot be used
      return {
        error:
          `Target herd '${targetHerdName}' is archived and cannot be split into.`,
      };
    }

    const session = this.client.startSession();
    session.startTransaction();
    try {
      // Remove from source herd
      await this.groups.updateOne(
        { _id: sourceHerdName },
        { $pullAll: { members: animalsToMove } },
        { session },
      );

      // Add to target herd
      await this.groups.updateOne(
        { _id: targetHerdName },
        { $addToSet: { members: { $each: animalsToMove } } }, // $addToSet ensures uniqueness
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
   * deleteHerd (herdName: String): Empty | {error: String}
   * requires a herd with `herdName` exists.
   * effects If the herd is not archived, it is flagged as `isArchived: true` and its `members` are cleared. If the herd is already archived, it is permanently removed from the database.
   */
  async deleteHerd(
    { herdName }: { herdName: string },
  ): Promise<Empty | { error: string }> {
    const herd = await this.groups.findOne({ _id: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found.` };
    }

    if (herd.isArchived) {
      // Herd is already archived, proceed with permanent deletion
      const deleteResult = await this.groups.deleteOne({ _id: herdName });
      if (deleteResult.deletedCount === 0) {
        return { error: `Failed to permanently delete archived herd '${herdName}'.` };
      }
      return {};
    } else {
      // Herd is not archived, soft delete by marking as archived and clearing members
      const updateResult = await this.groups.updateOne(
        { _id: herdName },
        { $set: { isArchived: true, members: [] } }, // Also clear members on archive
      );
      if (updateResult.modifiedCount === 0) {
        return { error: `Failed to archive herd '${herdName}'.` };
      }
      return {};
    }
  }

  /**
   * restoreHerd (herdName: String): Empty | {error: String}
   * requires a herd with `herdName` exists and is currently archived.
   * effects The specified herd is unarchived by setting `isArchived: false`.
   */
  async restoreHerd(
    { herdName }: { herdName: string },
  ): Promise<Empty | { error: string }> {
    const herd = await this.groups.findOne({ _id: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found.` };
    }
    if (!herd.isArchived) {
      return { error: `Herd '${herdName}' is not archived and cannot be restored.` };
    }

    const updateResult = await this.groups.updateOne(
      { _id: herdName },
      { $set: { isArchived: false } },
    );

    if (updateResult.modifiedCount === 0) {
      return { error: `Failed to restore herd '${herdName}'.` };
    }
    return {};
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
   * _listActiveHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
   * effects return a list of all unarchived herds with their names, descriptions, and archived status.
   */
  async _listActiveHerds(): Promise<
    {
      herds: Array<{ name: string; description?: string; isArchived: boolean }>;
    }
  > {
    const herds = await this.groups.find(
      { isArchived: false },
      { projection: { _id: 0, name: 1, description: 1, isArchived: 1 } },
    ).toArray();
    return { herds: herds };
  }

  /**
   * _listArchivedHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
   * effects return a list of all archived herds with their names, descriptions, and archived status.
   */
  async _listArchivedHerds(): Promise<
    {
      herds: Array<{ name: string; description?: string; isArchived: boolean }>;
    }
  > {
    const herds = await this.groups.find(
      { isArchived: true },
      { projection: { _id: 0, name: 1, description: 1, isArchived: 1 } },
    ).toArray();
    return { herds: herds };
  }
}
```
