/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * Reusable primitives for domain clients that wrap `IDataStreamClient` from
 * `@kbn/data-streams`. They exist because every consumer of `GetFieldsOf<...>`
 * has to deal with the same two friction points:
 *
 *  - The inferred document type wraps every field as `T | T[] | undefined`
 *    (see `PartialWithArrayValues` in `@kbn/es-mappings`), so reading a scalar
 *    or array out of `_source` always needs a small helper.
 *  - `SearchResponse.hits.total` is polymorphic (`number` or `{ value }`), and
 *    `BulkResponse` does not expose a count of failed items directly.
 *
 * These helpers stay here (inside the streams plugin) intentionally — the
 * detection client is the reference example for the data-stream pattern, and
 * future data-stream clients in this plugin should pull from the same module
 * rather than reinventing them. If they end up duplicated outside this plugin
 * they should be promoted to `@kbn/data-streams` (or a sibling util package).
 */

import type { BulkResponse, SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';

/**
 * Read a single scalar value from a field that may be returned as `T`, `T[]`,
 * or `undefined`. Use this when the field is a scalar in the strict mapping
 * but `GetFieldsOf<...>` exposes it as array-or-scalar.
 *
 * @example
 *   readScalar(stored.detection?.id) // -> string | undefined
 */
export function readScalar<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Read an array value from a field that may be returned as `T`, `T[]`, or
 * `undefined`.
 *
 *  - `undefined` -> `undefined`
 *  - `T`         -> `[T]`
 *  - `T[]`       -> `T[]`
 *
 * @example
 *   readArray(stored.detection?.tags) // -> string[] | undefined
 */
export function readArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

/**
 * Normalize the polymorphic `hits.total` field on an Elasticsearch search
 * response (`number` or `{ value, relation? }`) to a plain number. Returns
 * `0` when the field is missing entirely.
 */
export function normalizeSearchTotal(total: number | SearchTotalHits | undefined): number {
  if (typeof total === 'number') return total;
  return total?.value ?? 0;
}

/**
 * Summarize an Elasticsearch bulk response from `IDataStreamClient.create`.
 *
 * Returns `{ total, failed }` so callers can decide whether to log, throw,
 * or ignore. Counts items where either the `create` or `index` operation
 * carries an `error`.
 */
export function summarizeBulkErrors(response: BulkResponse): {
  total: number;
  failed: number;
} {
  const total = response.items.length;
  if (!response.errors) return { total, failed: 0 };

  const failed = response.items.reduce((acc, item) => {
    const op = item.create ?? item.index;
    return acc + (op?.error !== undefined ? 1 : 0);
  }, 0);

  return { total, failed };
}
