/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { BulkResponse } from '@elastic/elasticsearch/lib/api/types';
import { normalizeSearchTotal, readArray, readScalar, summarizeBulkErrors } from './helpers';

describe('readScalar', () => {
  it('returns undefined when the value is undefined', () => {
    expect(readScalar<string>(undefined)).toBeUndefined();
  });

  it('returns the value as-is when it is a scalar', () => {
    expect(readScalar('foo')).toBe('foo');
    expect(readScalar(0)).toBe(0);
    expect(readScalar(false)).toBe(false);
  });

  it('returns the first element when the value is an array', () => {
    expect(readScalar(['a', 'b'])).toBe('a');
  });

  it('returns undefined for an empty array', () => {
    expect(readScalar<string>([])).toBeUndefined();
  });
});

describe('readArray', () => {
  it('returns undefined when the value is undefined', () => {
    expect(readArray<string>(undefined)).toBeUndefined();
  });

  it('wraps a scalar into a single-element array', () => {
    expect(readArray('foo')).toEqual(['foo']);
  });

  it('returns the array as-is when the value is already an array', () => {
    expect(readArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('preserves an empty array', () => {
    expect(readArray<string>([])).toEqual([]);
  });
});

describe('normalizeSearchTotal', () => {
  it('returns 0 when total is undefined', () => {
    expect(normalizeSearchTotal(undefined)).toBe(0);
  });

  it('returns the number when total is already a number', () => {
    expect(normalizeSearchTotal(7)).toBe(7);
  });

  it('returns total.value when total is a SearchTotalHits object', () => {
    expect(normalizeSearchTotal({ value: 42, relation: 'eq' })).toBe(42);
  });
});

describe('summarizeBulkErrors', () => {
  it('reports 0 failures when errors is false', () => {
    const response = {
      errors: false,
      items: [{ create: {} }, { create: {} }],
    } as unknown as BulkResponse;

    expect(summarizeBulkErrors(response)).toEqual({ total: 2, failed: 0 });
  });

  it('counts items that carry an error on either `create` or `index`', () => {
    const response = {
      errors: true,
      items: [
        { create: { error: { type: 'mapper_parsing_exception' } } },
        { create: {} },
        { index: { error: { type: 'version_conflict_engine_exception' } } },
        { index: {} },
      ],
    } as unknown as BulkResponse;

    expect(summarizeBulkErrors(response)).toEqual({ total: 4, failed: 2 });
  });

  it('handles an empty response', () => {
    const response = { errors: false, items: [] } as unknown as BulkResponse;
    expect(summarizeBulkErrors(response)).toEqual({ total: 0, failed: 0 });
  });
});
