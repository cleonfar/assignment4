import { Collection, Db, MongoClient } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "HerdGrouping" + ".";

type User = ID; // User IDs are external, generic IDs
type Animal = ID; // Animal IDs are external, generic IDs

/**
 * a set of `groups` with
 *   a unique internal `_id` of type `ID` (globally unique document identifier)
 *   a `userId` of type `User` (the owner of the herd)
 *   a `name` of type `String` (unique *per user*)
 *   an optional `description` of type `String`
 *   a `members` set of `Animal` IDs
 *   a `isArchived` Boolean (default false)
 * Unique Constraint: No two herds can have the same `name` for the same `userId`.
 */
interface Herd {
  _id: ID; // Unique ID for the herd document
  userId: User; // Owner of the herd
  name: string; // User-defined name, unique per user
  description?: string;
  members: Animal[];
  isArchived: boolean;
}

export default class HerdGroupingConcept {
  groups: Collection<Herd>;

  // Accept and store the MongoClient instance for transactions
  constructor(
    private readonly db: Db,
    private readonly client?: MongoClient,
  ) {
    this.groups = this.db.collection<Herd>(PREFIX + "groups");
    // Ensure unique index for (userId, name)
    // In a real app, you'd typically await this in your main startup logic
    // or ensure it's run via a migration script, as it returns a Promise.
    // Placing it directly in the constructor is acceptable for concept examples.
    this.groups.createIndex({ userId: 1, name: 1 }, {
      unique: true,
      background: true,
    })
      .catch(console.error); // Log any errors during index creation
  }

  /**
   * createHerd (user: User, name: String, description?: String): ({herdName: String} | {error: String})
   * requires a herd with `name` does not already exist *for the given `user`*.
   * effects create a new herd with a unique internal `_id`, owned by `user`, with the given `name`, optional `description`, `isArchived: false`, and an empty set of `members`. Return the `herdName`.
   */
  async createHerd(
    { user, name, description }: {
      user: User;
      name: string;
      description?: string;
    },
  ): Promise<{ herdName: string } | { error: string }> {
    if (!name || name.trim() === "") {
      return { error: "Herd name cannot be empty." };
    }

    // Check for existing herd for THIS user with THIS name
    const existingHerd = await this.groups.findOne({
      userId: user,
      name: name,
    });
    if (existingHerd) {
      return { error: `Herd '${name}' already exists for user '${user}'.` };
    }

    const newHerd: Herd = {
      _id: freshID(), // Generate a globally unique ID for the document
      userId: user,
      name: name,
      description: description,
      members: [],
      isArchived: false,
    };

    await this.groups.insertOne(newHerd);
    return { herdName: name }; // Still returning just the user-facing name
  }

  /**
   * addAnimal (user: User, herdName: String, animal: Animal): Empty | {error: String}
   * requires a herd with `herdName` owned by `user` exists, is not archived, and `animal` is *not* already a member of that herd.
   * effects add the `animal` to the `members` of the specified `herd`.
   */
  async addAnimal(
    { user, herdName, animal }: {
      user: User;
      herdName: string;
      animal: Animal;
    },
  ): Promise<Empty | { error: string }> {
    // Query for the herd, scoped by userId and name
    const herd = await this.groups.findOne({ userId: user, name: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found for user '${user}'.` };
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

    // Use the document's internal _id for efficient update once found
    await this.groups.updateOne(
      { _id: herd._id },
      { $addToSet: { members: animal } },
    );
    return {};
  }

  /**
   * removeAnimal (user: User, herdName: String, animal: Animal): Empty | {error: String}
   * requires a herd with `herdName` owned by `user` exists, is not archived, and `animal` is a member of that herd.
   * effects remove the `animal` from the `members` of the specified `herd`.
   */
  async removeAnimal(
    { user, herdName, animal }: {
      user: User;
      herdName: string;
      animal: Animal;
    },
  ): Promise<Empty | { error: string }> {
    const herd = await this.groups.findOne({ userId: user, name: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found for user '${user}'.` };
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
      { _id: herd._id }, // Use the document's internal _id for efficient update once found
      { $pull: { members: animal } },
    );
    return {};
  }

  /**
   * moveAnimal (user: User, sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}
   * requires `sourceHerd` and `targetHerd` both owned by `user` exist, are not archived, and `animal` is a member of `sourceHerd`.
   * effects remove `animal` from `sourceHerd` and add it to `targetHerd` (if not already present).
   */
  async moveAnimal(
    { user, sourceHerdName, targetHerdName, animal }: {
      user: User;
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

    // Find both herds, ensuring they belong to the current user
    const sourceHerd = await this.groups.findOne({
      userId: user,
      name: sourceHerdName,
    });
    const targetHerd = await this.groups.findOne({
      userId: user,
      name: targetHerdName,
    });

    if (!sourceHerd) {
      return {
        error: `Source herd '${sourceHerdName}' not found for user '${user}'.`,
      };
    }
    if (sourceHerd.isArchived) {
      return { error: `Source herd '${sourceHerdName}' is archived.` };
    }
    if (!targetHerd) {
      return {
        error: `Target herd '${targetHerdName}' not found for user '${user}'.`,
      };
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

    const session = this.client?.startSession?.();
    if (session) {
      session.startTransaction();
      try {
        // Update by internal _id for robustness within transaction
        await this.groups.updateOne(
          { _id: sourceHerd._id },
          { $pull: { members: animal } },
          { session },
        );
        await this.groups.updateOne(
          { _id: targetHerd._id },
          { $addToSet: { members: animal } },
          { session },
        );
        await session.commitTransaction();
        return {};
      } catch (e) {
        try {
          await session.abortTransaction();
        } catch (_e) {
          // ignore abort errors
        }
        console.error("Transaction failed during moveAnimal:", e);
        return { error: "Failed to move animal due to a database error." };
      } finally {
        await session.endSession();
      }
    }

    // Fallback non-transactional updates
    await this.groups.updateOne(
      { _id: sourceHerd._id },
      { $pull: { members: animal } },
    );
    await this.groups.updateOne(
      { _id: targetHerd._id },
      { $addToSet: { members: animal } },
    );
    return {};
  }

  /**
   * mergeHerds (user: User, herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}
   * requires `herdNameToKeep` and `herdNameToArchive` both owned by `user` exist, are not archived, and `herdNameToKeep` is not the same as `herdNameToArchive`.
   * effects move all animals from `herdNameToArchive` to `herdNameToKeep`. Mark `herdNameToArchive` as `isArchived: true` and clear its members.
   */
  async mergeHerds(
    { user, herdNameToKeep, herdNameToArchive }: {
      user: User;
      herdNameToKeep: string;
      herdNameToArchive: string;
    },
  ): Promise<Empty | { error: string }> {
    if (herdNameToKeep === herdNameToArchive) {
      return { error: "Cannot merge a herd into itself." };
    }

    // If we have a client capable of transactions, perform reads and writes within a single transaction
    if (this.client && typeof this.client.startSession === "function") {
      const session = this.client.startSession();
      session.startTransaction();
      try {
        const herdToKeep = await this.groups.findOne({
          userId: user,
          name: herdNameToKeep,
        }, { session });
        const herdToArchive = await this.groups.findOne({
          userId: user,
          name: herdNameToArchive,
        }, { session });

        if (!herdToKeep) {
          await session.abortTransaction();
          await session.endSession();
          return {
            error: `Herd '${herdNameToKeep}' not found for user '${user}'.`,
          };
        }
        if (herdToKeep.isArchived) {
          await session.abortTransaction();
          await session.endSession();
          return { error: `Herd '${herdNameToKeep}' is archived.` };
        }
        if (!herdToArchive) {
          await session.abortTransaction();
          await session.endSession();
          return {
            error: `Herd '${herdNameToArchive}' not found for user '${user}'.`,
          };
        }
        if (herdToArchive.isArchived) {
          await session.abortTransaction();
          await session.endSession();
          return { error: `Herd '${herdNameToArchive}' is already archived.` };
        }

        const animalsToMove = herdToArchive.members;

        // Add all animals from herdToArchive to herdToKeep (using $addToSet to avoid duplicates)
        if (animalsToMove.length > 0) {
          await this.groups.updateOne(
            { _id: herdToKeep._id }, // Update by internal _id
            { $addToSet: { members: { $each: animalsToMove } } },
            { session },
          );
        }

        // Archive herdToArchive and clear its members
        await this.groups.updateOne(
          { _id: herdToArchive._id }, // Update by internal _id
          { $set: { isArchived: true, members: [] } },
          { session },
        );

        await session.commitTransaction();
        return {};
      } catch (e) {
        try {
          await session.abortTransaction();
        } catch (_e) {
          // ignore abort errors
        }
        console.error("Transaction failed during mergeHerds:", e);
        return { error: "Failed to merge herds due to a database error." };
      } finally {
        await session.endSession();
      }
    }

    // Fallback: non-transactional path (best-effort if client is unavailable)
    const herdToKeep = await this.groups.findOne({
      userId: user,
      name: herdNameToKeep,
    });
    const herdToArchive = await this.groups.findOne({
      userId: user,
      name: herdNameToArchive,
    });

    if (!herdToKeep) {
      return {
        error: `Herd '${herdNameToKeep}' not found for user '${user}'.`,
      };
    }
    if (herdToKeep.isArchived) {
      return { error: `Herd '${herdNameToKeep}' is archived.` };
    }
    if (!herdToArchive) {
      return {
        error: `Herd '${herdNameToArchive}' not found for user '${user}'.`,
      };
    }
    if (herdToArchive.isArchived) {
      return { error: `Herd '${herdNameToArchive}' is already archived.` };
    }

    const animalsToMove = herdToArchive.members;
    if (animalsToMove.length > 0) {
      await this.groups.updateOne(
        { _id: herdToKeep._id },
        { $addToSet: { members: { $each: animalsToMove } } },
      );
    }
    await this.groups.updateOne(
      { _id: herdToArchive._id },
      { $set: { isArchived: true, members: [] } },
    );
    return {};
  }

  /**
   * splitHerd (user: User, sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}
   * requires `sourceHerd` owned by `user` exists and is not archived. All `animalsToMove` are members of `sourceHerd`. If `targetHerd` (for the same `user`) already exists, it must not be archived.
   * effects If `targetHerdName` does not exist for this `user`, a new unarchived herd owned by `user` with that `name` and an empty `description` is created. Then, the specified `animalsToMove` are removed from `sourceHerd` and added to `targetHerd` (if not already present).
   */
  async splitHerd(
    { user, sourceHerdName, targetHerdName, animalsToMove }: {
      user: User;
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

    // Find source herd, ensuring it belongs to the current user
    const sourceHerd = await this.groups.findOne({
      userId: user,
      name: sourceHerdName,
    });
    if (!sourceHerd) {
      return {
        error: `Source herd '${sourceHerdName}' not found for user '${user}'.`,
      };
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

    // Find or create target herd, ensuring it belongs to the current user
    let targetHerd = await this.groups.findOne({
      userId: user,
      name: targetHerdName,
    });

    if (!targetHerd) {
      // If target herd does not exist for this user, attempt to create it
      try {
        const createResult = await this.createHerd({
          user,
          name: targetHerdName,
        });
        if ("error" in createResult) {
          // If creation fails (e.g., validation in createHerd), try to re-fetch in case of a race
          const refetched = await this.groups.findOne({
            userId: user,
            name: targetHerdName,
          });
          if (!refetched) {
            return {
              error:
                `Failed to create target herd '${targetHerdName}' for user '${user}': ${createResult.error}`,
            };
          }
          targetHerd = refetched;
        } else {
          // Re-fetch the newly created herd to get its full document including _id
          targetHerd = await this.groups.findOne({
            userId: user,
            name: targetHerdName,
          });
          if (!targetHerd) { // Should not happen if createHerd succeeded
            return {
              error:
                `Internal error: newly created target herd '${targetHerdName}' not found for user '${user}'.`,
            };
          }
        }
      } catch (e) {
        // Handle potential race where another process created the herd concurrently
        const refetched = await this.groups.findOne({
          userId: user,
          name: targetHerdName,
        });
        if (!refetched) {
          console.error("Error creating target herd in splitHerd:", e);
          return {
            error:
              `Failed to create target herd '${targetHerdName}' for user '${user}'.`,
          };
        }
        targetHerd = refetched;
      }
    } else if (targetHerd.isArchived) {
      // If target herd exists but is archived, it cannot be used
      return {
        error:
          `Target herd '${targetHerdName}' is archived and cannot be split into for user '${user}'.`,
      };
    }

    const session = this.client?.startSession?.();
    if (session) {
      session.startTransaction();
      try {
        // Remove from source herd (using internal _id)
        await this.groups.updateOne(
          { _id: sourceHerd._id },
          { $pullAll: { members: animalsToMove } },
          { session },
        );

        // Add to target herd (using internal _id and $addToSet for uniqueness)
        await this.groups.updateOne(
          { _id: targetHerd._id },
          { $addToSet: { members: { $each: animalsToMove } } },
          { session },
        );

        await session.commitTransaction();
        return {};
      } catch (e) {
        try {
          await session.abortTransaction();
        } catch (_e) {
          // ignore abort errors
        }
        console.error("Transaction failed during splitHerd:", e);
        return { error: "Failed to split herd due to a database error." };
      } finally {
        await session.endSession();
      }
    }

    // Fallback non-transactional updates
    await this.groups.updateOne(
      { _id: sourceHerd._id },
      { $pullAll: { members: animalsToMove } },
    );
    await this.groups.updateOne(
      { _id: targetHerd._id },
      { $addToSet: { members: { $each: animalsToMove } } },
    );
    return {};
  }

  /**
   * deleteHerd (user: User, herdName: String): Empty | {error: String}
   * requires a herd with `herdName` owned by `user` exists.
   * effects If the herd is not archived, it is flagged as `isArchived: true` and its `members` are cleared. If the herd is already archived, it is permanently removed from the database.
   */
  async deleteHerd(
    { user, herdName }: { user: User; herdName: string },
  ): Promise<Empty | { error: string }> {
    const herd = await this.groups.findOne({ userId: user, name: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found for user '${user}'.` };
    }

    if (herd.isArchived) {
      // Herd is already archived, proceed with permanent deletion (using internal _id)
      const deleteResult = await this.groups.deleteOne({ _id: herd._id });
      if (deleteResult.deletedCount === 0) {
        return {
          error: `Failed to permanently delete archived herd '${herdName}'.`,
        };
      }
      return {};
    } else {
      // Herd is not archived, soft delete by marking as archived and clearing members (using internal _id)
      const updateResult = await this.groups.updateOne(
        { _id: herd._id },
        { $set: { isArchived: true, members: [] } },
      );
      if (updateResult.modifiedCount === 0) {
        return { error: `Failed to archive herd '${herdName}'.` };
      }
      return {};
    }
  }

  /**
   * restoreHerd (user: User, herdName: String): Empty | {error: String}
   * requires a herd with `herdName` owned by `user` exists and is currently archived.
   * effects The specified herd is unarchived by setting `isArchived: false`.
   */
  async restoreHerd(
    { user, herdName }: { user: User; herdName: string },
  ): Promise<Empty | { error: string }> {
    const herd = await this.groups.findOne({ userId: user, name: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found for user '${user}'.` };
    }
    if (!herd.isArchived) {
      return {
        error: `Herd '${herdName}' is not archived and cannot be restored.`,
      };
    }

    // Unarchive by setting isArchived to false (using internal _id)
    const updateResult = await this.groups.updateOne(
      { _id: herd._id },
      { $set: { isArchived: false } },
    );

    if (updateResult.modifiedCount === 0) {
      return { error: `Failed to restore herd '${herdName}'.` };
    }
    return {};
  }

  /**
   * _viewComposition (user: User, herdName: String): ({animals: Array<Animal>} | {error: String})
   * requires a herd with `herdName` owned by `user` exists.
   * effects return the current members of the `herd`.
   */
  async _viewComposition(
    { user, herdName }: { user: User; herdName: string },
  ): Promise<{ animals: Animal[] } | { error: string }> {
    const herd = await this.groups.findOne({ userId: user, name: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found for user '${user}'.` };
    }

    return { animals: herd.members };
  }

  /**
   * _listActiveHerds (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
   * effects return a list of all unarchived herds owned by `user` with their names, descriptions, and archived status.
   */
  async _listActiveHerds(
    { user }: { user: User },
  ): Promise<
    {
      herds: Array<{ name: string; description?: string; isArchived: boolean }>;
    }
  > {
    // List herds, filtered by userId and isArchived status
    const herds = await this.groups.find(
      { userId: user, isArchived: false },
      { projection: { _id: 0, name: 1, description: 1, isArchived: 1 } },
    ).toArray();
    return { herds: herds };
  }

  /**
   * _listArchivedHerds (user: User): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})
   * effects return a list of all archived herds owned by `user` with their names, descriptions, and archived status.
   */
  async _listArchivedHerds(
    { user }: { user: User },
  ): Promise<
    {
      herds: Array<{ name: string; description?: string; isArchived: boolean }>;
    }
  > {
    // List herds, filtered by userId and isArchived status
    const herds = await this.groups.find(
      { userId: user, isArchived: true },
      { projection: { _id: 0, name: 1, description: 1, isArchived: 1 } },
    ).toArray();
    return { herds: herds };
  }
}
