/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FeatureWithFilter } from '@kbn/streams-schema';
import { conditionToQueryDsl } from '@kbn/streamlang';
import type { QueryDslQueryContainer } from '@kbn/data-views-plugin/common/types';

export function buildEntityExclusionFilter(
  features: FeatureWithFilter[],
  maxFilters = 10
): QueryDslQueryContainer | undefined {
  if (features.length === 0) {
    return undefined;
  }
  const capped = [...features]
    .sort((a, b) => b.last_seen.localeCompare(a.last_seen))
    .slice(0, maxFilters);
  return { bool: { must_not: capped.map(({ filter }) => conditionToQueryDsl(filter)) } };
}
