/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IDataStreamClient } from '@kbn/data-streams';
import { dateRangeQuery } from '@kbn/es-query';
import { type CommonSearchOptions } from '../query_utils';
import { readScalar } from '../storage_utils';
import { TIMESTAMP } from './fields';
import { type StoredDetection, type detectionsMappings } from './data_stream';

export interface Detection {
  '@timestamp': string;
  rule_uuid: string;
  rule_name: string;
  stream: string;
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

  async search(options: CommonSearchOptions = {}): Promise<{ hits: Detection[] }> {
    const response = await this.clients.dataStreamClient.search({
      space: this.clients.space,
      size: DEFAULT_PAGE_SIZE,
      _source: true,
      query: { bool: { filter: dateRangeQuery(options.from, options.to, TIMESTAMP) } },
      sort: [{ [TIMESTAMP]: { order: 'desc' } }],
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
