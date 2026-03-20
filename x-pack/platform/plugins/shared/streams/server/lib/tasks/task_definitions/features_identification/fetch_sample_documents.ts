/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import type { FeatureWithFilter } from '@kbn/streams-schema';
import { getSampleDocuments } from '@kbn/ai-tools/src/tools/describe_dataset/get_sample_documents';
import { getConditionFields } from '@kbn/streamlang';
import { compact } from 'lodash';
import { getEntityFilters, MAX_FILTERS } from './get_entity_filters';

const DEFAULT_SAMPLE_SIZE = 20;
const ENTITY_FILTERED_RATIO = 0.6;

export async function fetchSampleDocuments({
  esClient,
  index,
  start,
  end,
  features,
  size = DEFAULT_SAMPLE_SIZE,
}: {
  esClient: ElasticsearchClient;
  index: string;
  start: number;
  end: number;
  features: FeatureWithFilter[];
  size?: number;
}) {
  const entityFilters = getEntityFilters(features, MAX_FILTERS);
  if (entityFilters.length === 0) {
    const { hits } = await getSampleDocuments({ esClient, index, start, end, size });
    return { documents: hits, totalFilters: 0, filtersCapped: false, hasFilteredDocuments: false };
  }

  // Detect fields used in the entity filters that are not mapped in the index,
  // and inject them as keyword runtime mappings so the must_not clauses don't fail.
  const usedFields = [
    ...new Set(
      features.flatMap(({ filter }) => getConditionFields(filter).map(({ name }) => name))
    ),
  ];
  const fieldCaps = await esClient.fieldCaps({ index, fields: usedFields });
  const entityFilterRuntimeMappings: Record<string, { type: 'keyword' }> = Object.fromEntries(
    usedFields
      .filter((field) => !fieldCaps.fields[field])
      .map((field) => [field, { type: 'keyword' as const }])
  );

  const entityFilteredSize = Math.round(size * ENTITY_FILTERED_RATIO);
  const [{ hits: entityFilteredDocs }, { hits: unfilteredDocs }] = await Promise.all([
    getSampleDocuments({
      esClient,
      index,
      start,
      end,
      size: entityFilteredSize,
      filter: { bool: { must_not: entityFilters } },
      runtime_mappings: entityFilterRuntimeMappings,
    }),
    getSampleDocuments({
      esClient,
      index,
      start,
      end,
      size,
    }),
  ]);

  const seenIds = new Set<string>(compact(entityFilteredDocs.map(({ _id }) => _id)));
  const backfill = unfilteredDocs.filter(({ _id }) => _id && !seenIds.has(_id));

  return {
    documents: [...entityFilteredDocs, ...backfill.slice(0, size - entityFilteredDocs.length)],
    totalFilters: features.length,
    filtersCapped: features.length > MAX_FILTERS,
    hasFilteredDocuments: entityFilteredDocs.length > 0,
  };
}
