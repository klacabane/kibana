/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { QueryDslQueryContainer, SortOrder } from '@elastic/elasticsearch/lib/api/types';
import type { IDataStreamClient } from '@kbn/data-streams';
import { termQuery } from '@kbn/es-query';
import { readScalar } from '../storage_utils';
import { RULE_UUID, TIMESTAMP } from './fields';
import { type StoredDetection, type detectionsMappings } from './data_stream';

export interface Detection {
  '@timestamp': string;
  rule_uuid: string;
  rule_name: string;
  stream: string;
}

export interface FindByStreamOptions {
  size?: number;
  from?: string | number;
  to?: string | number;
  sortOrder?: SortOrder;
}

const DEFAULT_PAGE_SIZE = 1_000;

export type DetectionDataStreamClient = IDataStreamClient<
  typeof detectionsMappings,
  StoredDetection
>;

export class DetectionClient {
  constructor(
    private readonly clients: {
      dataStreamClient: DetectionDataStreamClient;
      space: string;
    }
  ) {}

  async bulkCreate(detections: Detection[]) {
    return this.clients.dataStreamClient.create({
      space: this.clients.space,
      documents: detections,
    });
  }

  async findByStream(
    ruleUuid: string,
    options: FindByStreamOptions = {}
  ): Promise<{ hits: Detection[] }> {
    const { size = DEFAULT_PAGE_SIZE, from, to, sortOrder = 'desc' } = options;

    const filters: QueryDslQueryContainer[] = [...termQuery(RULE_UUID, ruleUuid)];

    if (from !== undefined || to !== undefined) {
      filters.push({
        range: {
          [TIMESTAMP]: {
            ...(from !== undefined ? { gte: from } : {}),
            ...(to !== undefined ? { lte: to } : {}),
          },
        },
      });
    }

    const response = await this.clients.dataStreamClient.search({
      space: this.clients.space,
      size,
      _source: true,
      query: { bool: { filter: filters } },
      sort: [{ [TIMESTAMP]: { order: sortOrder } }],
    });

    return {
      hits: response.hits.hits.map((hit) => fromStorage(hit._source!)),
    };
  }
}

export function fromStorage(stored: StoredDetection): Detection {
  return {
    '@timestamp': readScalar(stored['@timestamp']) as string,
    rule_uuid: readScalar(stored.rule_uuid) as string,
    rule_name: readScalar(stored.rule_name) as string,
    stream: readScalar(stored.stream) as string,
  };
}
