declare const Brand: unique symbol;

/**
 * Generic ID: effectively a string,
 * but uses type branding.
 */
export type ID = string & { [Brand]: true };

/**
 * Empty record type: enforces no entries.
 */
export type Empty = Record<PropertyKey, never>;

/**
 * A special ID to indicate that the father of an animal is unknown or not specified.
 * This simplifies queries and ensures the `fatherId` field is always present in documents.
 */
export const UNKNOWN_FATHER_ID = "UNKNOWN_FATHER" as ID;

/**
 * A special ID to indicate that the mother of an animal is unknown or not specified.
 * This simplifies queries and ensures the `motherId` field is always present in documents.
 */
export const UNKNOWN_MOTHER_ID = "UNKNOWN_MOTHER" as ID;
