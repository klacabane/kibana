/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { QueryDslQueryContainer, SortOrder } from '@elastic/elasticsearch/lib/api/types';
import type { Logger } from '@kbn/core/server';
import type { IDataStreamClient } from '@kbn/data-streams';
import { termQuery } from '@kbn/es-query';
import { normalizeSearchTotal, readScalar, summarizeBulkErrors } from '../../data_streams';
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
      logger: Logger;
      space: string;
    }
  ) {}

  async bulkCreate(detections: Detection[]): Promise<{ created: number }> {
    if (detections.length === 0) {
      return { created: 0 };
    }

    const documents = detections.map(toStorage);

    const response = await this.clients.dataStreamClient.create({
      space: this.clients.space,
      documents,
    });
    const { failed, total } = summarizeBulkErrors(response);

    if (failed > 0) {
      this.clients.logger.error(`Failed to create ${failed}/${total} detections`, {
        tags: ['detections'],
      });
    }

    return { created: documents.length };
  }

  async findByStream(
    ruleUuid: string,
    options: FindByStreamOptions = {}
  ): Promise<{ hits: Detection[]; total: number }> {
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
      track_total_hits: true,
      query: { bool: { filter: filters } },
      sort: [{ [TIMESTAMP]: { order: sortOrder } }],
    });

    return {
      hits: response.hits.hits.flatMap((hit) => (hit._source ? [fromStorage(hit._source)] : [])),
      total: normalizeSearchTotal(response.hits.total),
    };
  }

  async exists(): Promise<boolean> {
    return this.clients.dataStreamClient.exists();
  }
}

export function toStorage(detection: Detection): StoredDetection {
  return {
    '@timestamp': detection['@timestamp'],
    rule_uuid: detection.rule_uuid,
    rule_name: detection.rule_name,
    stream: detection.stream,
  } as StoredDetection;
}

export function fromStorage(stored: StoredDetection): Detection {
  return {
    '@timestamp': readScalar(stored['@timestamp']) as string,
    rule_uuid: readScalar(stored.rule_uuid) as string,
    rule_name: readScalar(stored.rule_name) as string,
    stream: readScalar(stored.stream) as string,
  };
}
