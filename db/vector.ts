import { customType } from "drizzle-orm/pg-core";

/**
 * pgvector column type for Drizzle. Stores number[] as `vector(dims)`.
 * Keep `dims` in sync with EMBEDDING_DIMS (see lib/env.ts, docs/05-SCHEMA.md).
 */
export const vector = (name: string, dims: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dims})`;
    },
    toDriver(value: number[]) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string) {
      return value
        .slice(1, -1)
        .split(",")
        .filter(Boolean)
        .map(Number);
    },
  })(name);

export const EMBEDDING_DIMS = 1024;
