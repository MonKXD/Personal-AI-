import { ulid } from "ulid";

/** Lexicographically sortable, URL-safe id. See docs/05-SCHEMA.md (IDs are ULIDs). */
export function newId(): string {
  return ulid();
}
