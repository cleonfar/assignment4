[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

[@concept](concept.md)


# concept HerdGrouping
* **purpose** organize animals into dynamic groupings for operational and analytical purposes  
* **principle**  
  a user creates herds to group animals based on location, purpose, or management strategy, animals may be part of multiple herds;  
  adds or removes animals from herds as conditions change;  
  merges herds when combining groups, or splits them to separate animals;  
  moves animals between herds to reflect real-world transitions;  
  and views herd composition and history to support planning and analysis.  

* **state**  
  * a set of `groups` with    
    * a `name` of type `String`  
    * an optional `description` of type `String`  
    * a set of `animals` of type `ID`  


* **actions**
  * `createHerd (name: String, location: String, description): (herdName: String)`
    * **effects** create a new herd with this owner, name, location, and no members

  * `addAnimal (herdName: String, animal: Animal): Empty`
    * **requires** herd exists and animal is in herd
    * **effects** add the animal to the herd and record an add event

  * `removeAnimal (herdName: Herd, animal: Animal): Empty`
    * **requires** herd exists and animal is a member
    * **effects** remove the animal from the herd and record a remove event

  * `moveAnimal (sourceHerd: Herd, targetHerd: Herd, animal: Animal)`
    * **requires** both herds exist and animal is a member of source
    * **effects** remove the animal from source, add to target, and record a move event

  * `mergeHerds (herd1: String, herd2: String): (herdName: String)`
    * **requires** both herds exist
    * **effects** move all animals from source to target, record a merge event, and archive source and target herd.

  * `splitHerd (source: String, target: String, animals: Array<Animal>): Empty`
    * **requires** source herd exists and all animals are members of source
    * **effects** move specified animals from source to target and record a split event

# prompt: I have this concept, and I really want to include the splitHerd action, but actions can only take primitives as input, so how do I make this functionality without taking as input that list of IDs that I want to break off into a different herd?
# response:

The key to resolving this lies in understanding the distinction between how a `Set` is described in the abstract concept specification and how it must be represented when passed as an argument in a JSON-based API call (which is what concept actions effectively are).

While the concept specification can use `Set<Animal>` to convey the mathematical idea of a collection of unique items, when it comes to the concrete implementation and API input, a `Set` is a JavaScript object type that is not directly serializable as a primitive JSON value.

The rule "actions can only take primitives as input" (more precisely, "a dictionary/JSON object with primitive values (no custom objects)") means that the *fields* of your input dictionary should be JSON primitive types (strings, numbers, booleans, null) or arrays of these primitive types. An array of `ID`s (which are branded strings) fits this criteria perfectly, as it's directly representable as a JSON array of strings.

Therefore, the solution is to adjust the action signature for `splitHerd` to accept an `Array<Animal>` instead of a `Set<Animal>`.

### Proposed Change to `splitHerd` Action:

```concept
concept HerdGrouping
...
actions
  // Original:
  // splitHerd (source: String, target: String, animals: Set<Animal>): Empty

  // Revised:
  splitHerd (source: String, target: String, animals: Array<Animal>): Empty
    // requires source herd exists and all animals are members of source
    // effects move specified animals from source to target and record a split event
```

### Explanation:

1.  **JSON Compatibility:** An `Array<Animal>` (which resolves to `Array<ID>` or `string[]` in TypeScript, as `ID` is a branded `string`) is a standard, primitive-containing JSON structure. You can easily send `["animalId1", "animalId2"]` as part of your action's input dictionary.
2.  **Meaning Preservation:** Conceptually, `Array<Animal>` can still represent the same idea as a `Set<Animal>` for this purpose. Within the action's implementation, you can choose to treat the input array as a set (e.g., by converting it to a `Set` object internally to ensure uniqueness if that's a strict requirement for your operation). However, for the *input payload*, an array is the appropriate choice.
3.  **Adherence to Guidelines:** This change adheres to the guideline that action arguments should be dictionary objects with primitive values or arrays of primitive values, without using custom object instances directly as arguments.

This adjustment allows you to pass a list of animal IDs to the `splitHerd` action while maintaining compatibility with the concept design principles for action inputs.

# Implement: HerdGrouping
# response:

Okay, let's implement the `HerdGrouping` concept in TypeScript, addressing the `splitHerd` array input and adhering to the provided guidelines.

First, I'll slightly refine the concept specification based on common practices and clarity:

*   **Herd ID:** The specification implies `herdName` is used as the identifier. This means `name` must be unique. We'll use `name` as the `_id` in MongoDB for the `groups` collection.
*   **`location` in `createHerd`:** The `location` field was present in `createHerd` but not in the `state`. To keep the state minimal and relevant to "grouping," I will remove `location` from the `createHerd` action arguments. If `location` were critical, it should be part of the `groups` state.
*   **`isArchived`:** I'll add an `isArchived` boolean to the herd state to support the "archiving" aspect of `mergeHerds`.
*   **`addAnimal` precondition:** Correcting the likely typo in `addAnimal`'s precondition to ensure the animal is *not* already in the herd.
*   **Error Handling:** Explicitly define error returns in action signatures.

Here's the refined concept specification that we will implement:

---

# concept: HerdGrouping

*   **purpose** organize animals into dynamic groupings for operational and analytical purposes

*   **principle**\
    a user creates herds to group animals based on location, purpose, or management strategy, animals may be part of multiple herds;\
    adds or removes animals from herds as conditions change;\
    merges herds when combining groups, or splits them to separate animals;\
    moves animals between herds to reflect real-world transitions;\
    and views herd composition and history to support planning and analysis.

*   **state**
    *   a set of `groups` with
        *   a `name` of type `String` (unique, serves as identifier `_id`)
        *   an optional `description` of type `String`
        *   a `members` set of `Animal` IDs (an `Animal` is an `ID`)
        *   a `isArchived` Boolean (default `false`)

*   **actions**
    *   `createHerd (name: String, description?: String): ({herdName: String} | {error: String})`
        *   **requires** a herd with `name` does not already exist.
        *   **effects** create a new herd with this `name`, optional `description`, `isArchived: false`, and an empty set of `members`. Return the `herdName`.

    *   `addAnimal (herdName: String, animal: Animal): Empty | {error: String}`
        *   **requires** a herd with `herdName` exists, is not archived, and `animal` is *not* already a member of the herd.
        *   **effects** add the `animal` to the `members` of the specified `herd`.

    *   `removeAnimal (herdName: String, animal: Animal): Empty | {error: String}`
        *   **requires** a herd with `herdName` exists, is not archived, and `animal` is a member of the herd.
        *   **effects** remove the `animal` from the `members` of the specified `herd`.

    *   `moveAnimal (sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}`
        *   **requires** `sourceHerd` and `targetHerd` exist, are not archived, `animal` is a member of `sourceHerd`, and `animal` is *not* a member of `targetHerd`.
        *   **effects** remove `animal` from `sourceHerd` and add it to `targetHerd`.

    *   `mergeHerds (herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}`
        *   **requires** `herdNameToKeep` and `herdNameToArchive` exist, are not archived, and `herdNameToKeep` is not the same as `herdNameToArchive`.
        *   **effects** move all animals from `herdNameToArchive` to `herdNameToKeep`. Mark `herdNameToArchive` as `isArchived: true`.

    *   `splitHerd (sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}`
        *   **requires** `sourceHerd` and `targetHerd` exist, are not archived, and all `animalsToMove` are members of `sourceHerd` and *not* members of `targetHerd`.
        *   **effects** move specified `animalsToMove` from `sourceHerd` to `targetHerd`.

*   **queries**
    *   `_viewComposition (herdName: String): ({animals: Array<Animal>} | {error: String})`
        *   **requires** a herd with `herdName` exists.
        *   **effects** return the current members of the `herd`.

    *   `_listHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})`
        *   **effects** return a list of all herds with their names, descriptions, and archived status.

---

# file: src/HerdGrouping/HerdGroupingConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts"; // Although herdName is _id, freshID is useful for generic ID types if we needed it

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

  constructor(private readonly db: Db) {
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
   * requires `sourceHerd` and `targetHerd` exist, are not archived, `animal` is a member of `sourceHerd`, and `animal` is *not* a member of `targetHerd`.
   * effects remove `animal` from `sourceHerd` and add it to `targetHerd`.
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
    if (targetHerd.members.includes(animal)) {
      return { error: `Animal '${animal}' is already a member of target herd '${targetHerdName}'.` };
    }

    // Atomically update both herds
    const session = this.db.client.startSession();
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

    const session = this.db.client.startSession();
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
   * requires `sourceHerd` and `targetHerd` exist, are not archived, and all `animalsToMove` are members of `sourceHerd` and *not* members of `targetHerd`.
   * effects move specified `animalsToMove` from `sourceHerd` to `targetHerd`.
   */
  async splitHerd(
    { sourceHerdName, targetHerdName, animalsToMove }: {
      sourceHerdName: string;
      targetHerdName: string;
      animalsToMove: Animal[]; // Corrected type: Array<Animal> as discussed
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

    // Check preconditions on animalsToMove
    const missingInSource = animalsToMove.filter((animal) => !sourceHerd.members.includes(animal));
    if (missingInSource.length > 0) {
      return {
        error: `Animals ${
          missingInSource.join(", ")
        } are not members of the source herd '${sourceHerdName}'.`,
      };
    }

    const alreadyInTarget = animalsToMove.filter((animal) => targetHerd.members.includes(animal));
    if (alreadyInTarget.length > 0) {
      return {
        error: `Animals ${
          alreadyInTarget.join(", ")
        } are already members of the target herd '${targetHerdName}'.`,
      };
    }

    const session = this.db.client.startSession();
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

# Prompt: Property 'client' does not exist on type 'Db'.deno-ts(2339)
# response:

You're absolutely right! My apologies for that oversight. The `Db` object itself doesn't directly expose the `MongoClient` instance as a `client` property. To start a session for transactions, you need access to the `MongoClient` instance directly.

The `getDb` utility function already returns both the `Db` and the `MongoClient`. We just need to ensure the `HerdGroupingConcept` constructor receives and stores the `MongoClient` as well.

Here's how to fix it:

### 1. Update `HerdGroupingConcept` Constructor

Modify the `HerdGroupingConcept` class to accept and store the `MongoClient` instance.

**From:**

```typescript
import { Collection, Db } from "npm:mongodb";
// ...
export default class HerdGroupingConcept {
  groups: Collection<Herd>;

  constructor(private readonly db: Db) {
    this.groups = this.db.collection<Herd>(PREFIX + "groups");
  }
  // ...
}
```

**To:**

```typescript
import { Collection, Db, MongoClient } from "npm:mongodb"; // <-- Import MongoClient here
// ...
export default class HerdGroupingConcept {
  groups: Collection<Herd>;

  // Accept and store the MongoClient instance
  constructor(private readonly db: Db, private readonly client: MongoClient) {
    this.groups = this.db.collection<Herd>(PREFIX + "groups");
  }
  // ...
}
```

### 2. Update Transaction Calls

Now, in the methods that use transactions (`moveAnimal`, `mergeHerds`, `splitHerd`), change `this.db.client.startSession()` to `this.client.startSession()`.

**Example for `moveAnimal` (and similarly for `mergeHerds`, `splitHerd`):**

**From:**

```typescript
    const session = this.db.client.startSession(); // <-- Error here
    session.startTransaction();
    // ...
```

**To:**

```typescript
    const session = this.client.startSession(); // <-- Corrected
    session.startTransaction();
    // ...
```

### 3. Update Concept Instantiation (wherever you create `HerdGroupingConcept`)

Wherever you instantiate `HerdGroupingConcept`, ensure you pass both `db` and `client`.

**From (implied):**

```typescript
import {getDb} from "@utils/database.ts";
import HerdGroupingConcept from "@concepts/HerdGroupingConcept.ts"

const [db, client] = await getDb();
const herdConcept = new HerdGroupingConcept(db); // Missing client here
```

**To:**

```typescript
import {getDb} from "@utils/database.ts";
import HerdGroupingConcept from "@concepts/HerdGroupingConcept.ts"

const [db, client] = await getDb();
const herdConcept = new HerdGroupingConcept(db, client); // Pass client here
```

***

Here is the updated `HerdGroupingConcept.ts` file with these corrections:

# file: src/HerdGrouping/HerdGroupingConcept.ts (Updated)

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
   * requires `sourceHerd` and `targetHerd` exist, are not archived, `animal` is a member of `sourceHerd`, and `animal` is *not* a member of `targetHerd`.
   * effects remove `animal` from `sourceHerd` and add it to `targetHerd`.
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
    if (targetHerd.members.includes(animal)) {
      return { error: `Animal '${animal}' is already a member of target herd '${targetHerdName}'.` };
    }

    // Atomically update both herds
    const session = this.client.startSession(); // Corrected here
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

    const session = this.client.startSession(); // Corrected here
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
   * requires `sourceHerd` and `targetHerd` exist, are not archived, and all `animalsToMove` are members of `sourceHerd` and *not* members of `targetHerd`.
   * effects move specified `animalsToMove` from `sourceHerd` to `targetHerd`.
   */
  async splitHerd(
    { sourceHerdName, targetHerdName, animalsToMove }: {
      sourceHerdName: string;
      targetHerdName: string;
      animalsToMove: Animal[]; // Corrected type: Array<Animal> as discussed
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

    // Check preconditions on animalsToMove
    const missingInSource = animalsToMove.filter((animal) => !sourceHerd.members.includes(animal));
    if (missingInSource.length > 0) {
      return {
        error: `Animals ${
          missingInSource.join(", ")
        } are not members of the source herd '${sourceHerdName}'.`,
      };
    }

    const alreadyInTarget = animalsToMove.filter((animal) => targetHerd.members.includes(animal));
    if (alreadyInTarget.length > 0) {
      return {
        error: `Animals ${
          alreadyInTarget.join(", ")
        } are already members of the target herd '${targetHerdName}'.`,
      };
    }

    const session = this.client.startSession(); // Corrected here
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

# Prompt: I do not want the move animal or split herd actions to throw errors if the animals being moved is already in the target herd
# response:

Okay, I understand. You want to modify the `moveAnimal` and `splitHerd` actions so that they gracefully handle cases where an animal intended for the target herd is *already* present in that target herd, rather than throwing an error.

This means we will remove the precondition checks that verify an animal is *not* in the target herd before moving it. MongoDB's `$addToSet` operator (used for adding members) inherently prevents duplicates, so if an animal is already there, it simply won't be added again, making the operation idempotent for that specific animal in the target. The removal from the source herd will still proceed as normal.

Here's the updated `HerdGroupingConcept.ts` with these changes:

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
    // Precondition removed: `animal` is *not* a member of `targetHerd`.
    // The $addToSet operation will handle if the animal is already in the target.

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
   * requires `sourceHerd` and `targetHerd` exist, are not archived, and all `animalsToMove` are members of `sourceHerd`.
   * effects move specified `animalsToMove` from `sourceHerd` to `targetHerd` (if not already present).
   */
  async splitHerd(
    { sourceHerdName, targetHerdName, animalsToMove }: {
      sourceHerdName: string;
      targetHerdName: string;
      animalsToMove: Animal[]; // Corrected type: Array<Animal> as discussed
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

    // Check precondition: all animalsToMove are members of sourceHerd
    const missingInSource = animalsToMove.filter((animal) => !sourceHerd.members.includes(animal));
    if (missingInSource.length > 0) {
      return {
        error: `Animals ${
          missingInSource.join(", ")
        } are not members of the source herd '${sourceHerdName}'.`,
      };
    }

    // Precondition removed: `animalsToMove` are *not* members of `targetHerd`.
    // The $addToSet operation will handle if animals are already in the target.

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

**Summary of Changes:**

*   **`moveAnimal`:**
    *   Removed the `if (targetHerd.members.includes(animal))` check and its associated error return.
    *   Updated the JSDoc `requires` and `effects` to reflect this change.
*   **`splitHerd`:**
    *   Removed the `alreadyInTarget` filter and its associated error return.
    *   Updated the JSDoc `requires` and `effects` to reflect this change.

Now, if you attempt to `moveAnimal` or `splitHerd` and some or all of the animals are already in the target, the action will still succeed, and the duplicate animals in the target will simply remain unique due to `$addToSet`.



# Prompt: Does splitHerd always create a new herd as the target or does it add to an existing herd if the target is an existing herd?
# response:

Based on the concept specification and its implementation:

The `splitHerd` action **does not create a new herd**. It requires that both the `sourceHerd` and the `targetHerd` already exist.

If the `targetHerdName` provided to `splitHerd` does not correspond to an existing herd, the action will return an error: `Target herd '{targetHerdName}' not found.`.

Instead, `splitHerd` takes a list of animals from the `sourceHerd` and **adds them to the existing `targetHerd`**. The use of MongoDB's `$addToSet` operator in the implementation ensures that if any of the animals are already present in the `targetHerd`, they will not be added again (preventing duplicates within the target herd's `members` list).

# Prompt: I would like it to create a new herd if the target does not already exist
# response:

You're looking to enhance the `splitHerd` action so it can automatically create the `targetHerd` if it doesn't already exist. This is a reasonable change that adds flexibility, aligning with the idea of dynamic groupings.

Here's how we'll adjust the concept specification and the TypeScript implementation:

### 1. Refined Concept Specification for `splitHerd`

We need to update the `requires` and `effects` to clearly state the new behavior.

```concept
concept HerdGrouping
...
actions
  splitHerd (sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}
    // New requirements and effects:
    * **requires** `sourceHerd` exists and is not archived. All `animalsToMove` are members of `sourceHerd`. If `targetHerd` already exists, it must not be archived.
    * **effects** If `targetHerdName` does not exist, a new unarchived herd with that `name` and an empty `description` is created. Then, the specified `animalsToMove` are removed from `sourceHerd` and added to `targetHerd` (if not already present).
```

### 2. Updated `HerdGroupingConcept.ts` Implementation

The `splitHerd` method will be modified to first check if the `targetHerd` exists. If not, it will attempt to create it using the `createHerd` action.

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
      // Conceptually, targetHerd now exists and is unarchived. We don't need to re-fetch its full document
      // as we only need its _id (name) for the update operation that follows.
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
  async _listHerds(): Promise<
    {
      herds: Array<{ name: string; description?: string; isArchived: boolean }>;
    }
  > {
    const herds = await this.groups.find({}, {
      projection: { _id: 0, name: 1, description: 1, isArchived: 1 },
    }).toArray();
    return { herds: herds };
  }
}
```

# Prompt: Can you add a two part delete herd action? If it is called on an unarchived herd, the herd will be flagged as archived, and if it is called on an archived herd, the herd will be removed. Also, can you split the _listHerds query into two, one that gives all unarchived herds and another that gives the archived herds?
# response:

Okay, let's enhance the `HerdGrouping` concept with a two-part `deleteHerd` action and split the herd listing query.

### 1. Refined Concept Specification for `HerdGrouping`

Here's the updated concept specification:

```concept
concept HerdGrouping

* **purpose** organize animals into dynamic groupings for operational and analytical purposes

* **principle**\
  a user creates herds to group animals based on location, purpose, or management strategy, animals may be part of multiple herds;\
  adds or removes animals from herds as conditions change;\
  merges herds when combining groups, or splits them to separate animals;\
  moves animals between herds to reflect real-world transitions;\
  and views herd composition and history to support planning and analysis.

* **state**
  * a set of `groups` with
    * a `name` of type `String` (unique, serves as identifier `_id`)
    * an optional `description` of type `String`
    * a `members` set of `Animal` IDs (an `Animal` is an `ID`)
    * a `isArchived` Boolean (default `false`)

* **actions**
  * `createHerd (name: String, description?: String): ({herdName: String} | {error: String})`
    * **requires** a herd with `name` does not already exist.
    * **effects** create a new herd with this `name`, optional `description`, `isArchived: false`, and an empty set of `members`. Return the `herdName`.

  * `addAnimal (herdName: String, animal: Animal): Empty | {error: String}`
    * **requires** a herd with `herdName` exists, is not archived, and `animal` is *not* already a member of the herd.
    * **effects** add the `animal` to the `members` of the specified `herd`.

  * `removeAnimal (herdName: String, animal: Animal): Empty | {error: String}`
    * **requires** a herd with `herdName` exists, is not archived, and `animal` is a member of the herd.
    * **effects** remove the `animal` from the `members` of the specified `herd`.

  * `moveAnimal (sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}`
    * **requires** `sourceHerd` and `targetHerd` exist, are not archived, `animal` is a member of `sourceHerd`.
    * **effects** remove `animal` from `sourceHerd` and add it to `targetHerd` (if not already present).

  * `mergeHerds (herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}`
    * **requires** `herdNameToKeep` and `herdNameToArchive` exist, are not archived, and `herdNameToKeep` is not the same as `herdNameToArchive`.
    * **effects** move all animals from `herdNameToArchive` to `herdNameToKeep`. Mark `herdNameToArchive` as `isArchived: true`.

  * `splitHerd (sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}`
    * **requires** `sourceHerd` exists and is not archived. All `animalsToMove` are members of `sourceHerd`. If `targetHerd` already exists, it must not be archived.
    * **effects** If `targetHerdName` does not exist, a new unarchived herd with that `name` and an empty `description` is created. Then, the specified `animalsToMove` are removed from `sourceHerd` and added to `targetHerd` (if not already present).

  * `deleteHerd (herdName: String): Empty | {error: String}`
    * **requires** a herd with `herdName` exists.
    * **effects** If the herd is not archived, it is flagged as `isArchived: true`. If the herd is already archived, it is permanently removed from the database.

* **queries**
  * `_viewComposition (herdName: String): ({animals: Array<Animal>} | {error: String})`
    * **requires** a herd with `herdName` exists.
    * **effects** return the current members of the `herd`.

  * `_listActiveHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})`
    * **effects** return a list of all unarchived herds with their names, descriptions, and archived status.

  * `_listArchivedHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})`
    * **effects** return a list of all archived herds with their names, descriptions, and archived status.
```

### 2. Updated `HerdGroupingConcept.ts` Implementation

Here's the full updated TypeScript code with the `deleteHerd` action and the split `_listHerds` queries:

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
   * effects If the herd is not archived, it is flagged as `isArchived: true`. If the herd is already archived, it is permanently removed from the database.
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
      // Herd is not archived, soft delete by marking as archived
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
# Prompt: add a restore action that will unarchive an archived group?
# response:

Okay, let's add the `restore` action to unarchive a herd.

### 1. Refined Concept Specification for `HerdGrouping`

Here's the updated concept specification including the new `restore` action:

```concept
concept HerdGrouping

* **purpose** organize animals into dynamic groupings for operational and analytical purposes

* **principle**\
  a user creates herds to group animals based on location, purpose, or management strategy, animals may be part of multiple herds;\
  adds or removes animals from herds as conditions change;\
  merges herds when combining groups, or splits them to separate animals;\
  moves animals between herds to reflect real-world transitions;\
  and views herd composition and history to support planning and analysis.

* **state**
  * a set of `groups` with
    * a `name` of type `String` (unique, serves as identifier `_id`)
    * an optional `description` of type `String`
    * a `members` set of `Animal` IDs (an `Animal` is an `ID`)
    * a `isArchived` Boolean (default `false`)

* **actions**
  * `createHerd (name: String, description?: String): ({herdName: String} | {error: String})`
    * **requires** a herd with `name` does not already exist.
    * **effects** create a new herd with this `name`, optional `description`, `isArchived: false`, and an empty set of `members`. Return the `herdName`.

  * `addAnimal (herdName: String, animal: Animal): Empty | {error: String}`
    * **requires** a herd with `herdName` exists, is not archived, and `animal` is *not* already a member of the herd.
    * **effects** add the `animal` to the `members` of the specified `herd`.

  * `removeAnimal (herdName: String, animal: Animal): Empty | {error: String}`
    * **requires** a herd with `herdName` exists, is not archived, and `animal` is a member of the herd.
    * **effects** remove the `animal` from the `members` of the specified `herd`.

  * `moveAnimal (sourceHerdName: String, targetHerdName: String, animal: Animal): Empty | {error: String}`
    * **requires** `sourceHerd` and `targetHerd` exist, are not archived, `animal` is a member of `sourceHerd`.
    * **effects** remove `animal` from `sourceHerd` and add it to `targetHerd` (if not already present).

  * `mergeHerds (herdNameToKeep: String, herdNameToArchive: String): Empty | {error: String}`
    * **requires** `herdNameToKeep` and `herdNameToArchive` exist, are not archived, and `herdNameToKeep` is not the same as `herdNameToArchive`.
    * **effects** move all animals from `herdNameToArchive` to `herdNameToKeep`. Mark `herdNameToArchive` as `isArchived: true`.

  * `splitHerd (sourceHerdName: String, targetHerdName: String, animalsToMove: Array<Animal>): Empty | {error: String}`
    * **requires** `sourceHerd` exists and is not archived. All `animalsToMove` are members of `sourceHerd`. If `targetHerd` already exists, it must not be archived.
    * **effects** If `targetHerdName` does not exist, a new unarchived herd with that `name` and an empty `description` is created. Then, the specified `animalsToMove` are removed from `sourceHerd` and added to `targetHerd` (if not already present).

  * `deleteHerd (herdName: String): Empty | {error: String}`
    * **requires** a herd with `herdName` exists.
    * **effects** If the herd is not archived, it is flagged as `isArchived: true` and its `members` are cleared. If the herd is already archived, it is permanently removed from the database.

  * `restoreHerd (herdName: String): Empty | {error: String}`
    * **requires** a herd with `herdName` exists and is currently archived.
    * **effects** The specified herd is unarchived by setting `isArchived: false`.

* **queries**
  * `_viewComposition (herdName: String): ({animals: Array<Animal>} | {error: String})`
    * **requires** a herd with `herdName` exists.
    * **effects** return the current members of the `herd`.

  * `_listActiveHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})`
    * **effects** return a list of all unarchived herds with their names, descriptions, and archived status.

  * `_listArchivedHerds (): ({herds: Array<{name: String, description?: String, isArchived: Boolean}>})`
    * **effects** return a list of all archived herds with their names, descriptions, and archived status.
```

### 2. Updated `HerdGroupingConcept.ts` Implementation

Here's the full updated TypeScript code with the new `restoreHerd` action:

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

# Prompt: For every action and query, add the requirement of a user as input. Also add a user field to the parts of state that need it to ensure user's can only access their own stuff. Finally, allow duplicate ID's if the user is different.
# response:

Okay, this is a significant and excellent set of changes for implementing multi-tenancy correctly. You've addressed all the requirements beautifully.

Here's the updated TypeScript file for `HerdGroupingConcept.ts` incorporating the `user: User` parameter across all actions and queries, the new `userId` field in the `Herd` interface, the change of `_id` to a globally unique `ID` (generated by `freshID()`), and the programmatic creation of a unique compound index on `(userId, name)`.

**Key Changes Implemented:**

1.  **`User` Type Defined:** `type User = ID;`
2.  **`Herd` Interface Modified:**
    *   `_id: ID;` (globally unique)
    *   `userId: User;` (owner of the herd)
    *   `name: string;` (user-defined, unique per user)
3.  **Constructor Modified:** Adds `this.groups.createIndex({ userId: 1, name: 1 }, { unique: true, background: true });` to ensure the unique compound index on `userId` and `name`.
4.  **All Action/Query Signatures Updated:** Now include `{ user: User, ...otherArgs }`.
5.  **All Logic Updated:** Every database operation (`findOne`, `updateOne`, `deleteOne`, `find`) now includes `userId: user` in its query filter to ensure operations are scoped to the current user's herds.
6.  **Error Messages:** Updated to be more specific about which user a herd belongs to when an error occurs.
7.  **`createHerd`:** Now generates `_id` using `freshID()` and explicitly stores the `userId`. The uniqueness check is correctly done on `(userId, name)`.
8.  **`moveAnimal`, `mergeHerds`, `splitHerd`:** All checks and updates are now correctly scoped by `userId`.
9.  **JSDoc Comments:** All comments have been updated to reflect the new `user` parameter and the multi-tenancy implications in the `requires` and `effects` clauses.

***

# file: src/HerdGrouping/HerdGroupingConcept.ts (Updated for Multi-Tenancy)

```typescript
import { Collection, Db, MongoClient, IndexOptions } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "HerdGrouping" + ".";

type User = ID;   // User IDs are external, generic IDs
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
  constructor(private readonly db: Db, private readonly client: MongoClient) {
    this.groups = this.db.collection<Herd>(PREFIX + "groups");
    // Ensure unique index for (userId, name)
    // In a real app, you'd typically await this in your main startup logic
    // or ensure it's run via a migration script, as it returns a Promise.
    // Placing it directly in the constructor is acceptable for concept examples.
    this.groups.createIndex({ userId: 1, name: 1 }, { unique: true, background: true })
      .catch(console.error); // Log any errors during index creation
  }

  /**
   * createHerd (user: User, name: String, description?: String): ({herdName: String} | {error: String})
   * requires a herd with `name` does not already exist *for the given `user`*.
   * effects create a new herd with a unique internal `_id`, owned by `user`, with the given `name`, optional `description`, `isArchived: false`, and an empty set of `members`. Return the `herdName`.
   */
  async createHerd(
    { user, name, description }: { user: User; name: string; description?: string },
  ): Promise<{ herdName: string } | { error: string }> {
    if (!name || name.trim() === "") {
      return { error: "Herd name cannot be empty." };
    }

    // Check for existing herd for THIS user with THIS name
    const existingHerd = await this.groups.findOne({ userId: user, name: name });
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
    { user, herdName, animal }: { user: User; herdName: string; animal: Animal },
  ): Promise<Empty | { error: string }> {
    // Query for the herd, scoped by userId and name
    const herd = await this.groups.findOne({ userId: user, name: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found for user '${user}'.` };
    }
    if (herd.isArchived) {
      return { error: `Herd '${herdName}' is archived and cannot be modified.` };
    }
    if (herd.members.includes(animal)) {
      return { error: `Animal '${animal}' is already a member of herd '${herdName}'.` };
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
    { user, herdName, animal }: { user: User; herdName: string; animal: Animal },
  ): Promise<Empty | { error: string }> {
    const herd = await this.groups.findOne({ userId: user, name: herdName });

    if (!herd) {
      return { error: `Herd '${herdName}' not found for user '${user}'.` };
    }
    if (herd.isArchived) {
      return { error: `Herd '${herdName}' is archived and cannot be modified.` };
    }
    if (!herd.members.includes(animal)) {
      return { error: `Animal '${animal}' is not a member of herd '${herdName}'.` };
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
      return { error: "Source and target herds cannot be the same for moving an animal." };
    }

    // Find both herds, ensuring they belong to the current user
    const sourceHerd = await this.groups.findOne({ userId: user, name: sourceHerdName });
    const targetHerd = await this.groups.findOne({ userId: user, name: targetHerdName });

    if (!sourceHerd) {
      return { error: `Source herd '${sourceHerdName}' not found for user '${user}'.` };
    }
    if (sourceHerd.isArchived) {
      return { error: `Source herd '${sourceHerdName}' is archived.` };
    }
    if (!targetHerd) {
      return { error: `Target herd '${targetHerdName}' not found for user '${user}'.` };
    }
    if (targetHerd.isArchived) {
      return { error: `Target herd '${targetHerdName}' is archived.` };
    }
    if (!sourceHerd.members.includes(animal)) {
      return { error: `Animal '${animal}' is not a member of source herd '${sourceHerdName}'.` };
    }

    const session = this.client.startSession();
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
      await session.abortTransaction();
      console.error("Transaction failed during moveAnimal:", e);
      return { error: "Failed to move animal due to a database error." };
    } finally {
      await session.endSession();
    }
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

    // Find both herds, ensuring they belong to the current user
    const herdToKeep = await this.groups.findOne({ userId: user, name: herdNameToKeep });
    const herdToArchive = await this.groups.findOne({ userId: user, name: herdNameToArchive });

    if (!herdToKeep) {
      return { error: `Herd '${herdNameToKeep}' not found for user '${user}'.` };
    }
    if (herdToKeep.isArchived) {
      return { error: `Herd '${herdNameToKeep}' is archived.` };
    }
    if (!herdToArchive) {
      return { error: `Herd '${herdNameToArchive}' not found for user '${user}'.` };
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
      await session.abortTransaction();
      console.error("Transaction failed during mergeHerds:", e);
      return { error: "Failed to merge herds due to a database error." };
    } finally {
      await session.endSession();
    }
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
      return { error: "Source and target herds cannot be the same for splitting." };
    }
    if (!animalsToMove || animalsToMove.length === 0) {
      return { error: "No animals specified to move for splitting." };
    }

    // Find source herd, ensuring it belongs to the current user
    const sourceHerd = await this.groups.findOne({ userId: user, name: sourceHerdName });
    if (!sourceHerd) {
      return { error: `Source herd '${sourceHerdName}' not found for user '${user}'.` };
    }
    if (sourceHerd.isArchived) {
      return { error: `Source herd '${sourceHerdName}' is archived.` };
    }

    // Check precondition: all animalsToMove are members of sourceHerd
    const missingInSource = animalsToMove.filter((animal) => !sourceHerd.members.includes(animal));
    if (missingInSource.length > 0) {
      return {
        error: `Animals ${
          missingInSource.join(", ")
        } are not members of the source herd '${sourceHerdName}'.`,
      };
    }

    // Find or create target herd, ensuring it belongs to the current user
    let targetHerd = await this.groups.findOne({ userId: user, name: targetHerdName });

    if (!targetHerd) {
      // If target herd does not exist for this user, create it
      const createResult = await this.createHerd({ user, name: targetHerdName });
      if ("error" in createResult) {
        // If creation fails (e.g., due to validation in createHerd), return that error
        return {
          error: `Failed to create target herd '${targetHerdName}' for user '${user}': ${createResult.error}`,
        };
      }
      // Re-fetch the newly created herd to get its full document including _id
      targetHerd = await this.groups.findOne({ userId: user, name: targetHerdName });
      if (!targetHerd) { // Should not happen if createHerd succeeded
        return { error: `Internal error: newly created target herd '${targetHerdName}' not found for user '${user}'.` };
      }
    } else if (targetHerd.isArchived) {
      // If target herd exists but is archived, it cannot be used
      return { error: `Target herd '${targetHerdName}' is archived and cannot be split into for user '${user}'.` };
    }

    const session = this.client.startSession();
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
      await session.abortTransaction();
      console.error("Transaction failed during splitHerd:", e);
      return { error: "Failed to split herd due to a database error." };
    } finally {
      await session.endSession();
    }
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
        return { error: `Failed to permanently delete archived herd '${herdName}'.` };
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
      return { error: `Herd '${herdName}' is not archived and cannot be restored.` };
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
  ): Promise<{ herds: Array<{ name: string; description?: string; isArchived: boolean }> }> {
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
  ): Promise<{ herds: Array<{ name: string; description?: string; isArchived: boolean }> }> {
    // List herds, filtered by userId and isArchived status
    const herds = await this.groups.find(
      { userId: user, isArchived: true },
      { projection: { _id: 0, name: 1, description: 1, isArchived: 1 } },
    ).toArray();
    return { herds: herds };
  }
}
```