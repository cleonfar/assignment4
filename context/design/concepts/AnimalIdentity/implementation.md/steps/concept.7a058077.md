---
timestamp: 'Sat Oct 11 2025 18:02:19 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251011_180219.5f4ba3f2.md]]'
content_id: 7a058077a30318beec8be3cbd6ee14096b4b3eb9d91b39ea7d1b9ef671a03abf
---

# concept: AnimalIdentity

**concept** AnimalIdentity \[Animal]

**purpose** provide a unique and persistent identification for individual animals, enabling tracking and association of attributes across different contexts.

**principle** after an animal is assigned a unique identifier (such as a microchip ID or tag number), this identifier can subsequently be used to reliably refer to that specific animal and associate it with relevant information.

**state**
  a set of Animals with
    an identityId String (unique)

**actions**
  assignIdentity (animal: Animal, identityId: String) : (error: String)
    **requires** `animal` is not already in `Animals`
        AND there is no existing `Animal` `a` such that `a.identityId = identityId`
    **effects** add `animal` to `Animals` and set `animal.identityId := identityId`
        (returns an empty dictionary on success if no error)

  reassignIdentity (animal: Animal, newIdentityId: String) : (error: String)
    **requires** `animal` is in `Animals`
        AND there is no other `Animal` `a` (where `a != animal`) such that `a.identityId = newIdentityId`
    **effects** set `animal.identityId := newIdentityId`
        (returns an empty dictionary on success if no error)

  revokeIdentity (animal: Animal) : (error: String)
    **requires** `animal` is in `Animals`
    **effects** remove `animal` from `Animals`
        (returns an empty dictionary on success if no error)

**queries**
  getAnimalByIdentityId (identityId: String): (animal: Animal)
    **effects** return the `Animal` entity `a` from `Animals` where `a.identityId = identityId`, if found;
        otherwise return an empty result.

***
