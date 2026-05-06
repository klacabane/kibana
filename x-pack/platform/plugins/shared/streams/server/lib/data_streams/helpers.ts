/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { BulkResponse, SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';

export function readScalar<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

export function normalizeSearchTotal(total: number | SearchTotalHits | undefined): number {
  if (typeof total === 'number') return total;
  return total?.value ?? 0;
}

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
