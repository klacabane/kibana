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
import { type StoredVerdict, type verdictsMappings } from './data_stream';

export interface Verdict {
  '@timestamp': string;
  verdict: string;
  verdict_id: string;
  discovery_id: string;
  discovery_slug: string;
  title: string;
}

const DEFAULT_PAGE_SIZE = 1_000;

export type VerdictDataStreamClient = IDataStreamClient<typeof verdictsMappings, StoredVerdict>;

export class VerdictClient {
  constructor(
    private readonly clients: {
      dataStreamClient: VerdictDataStreamClient;
      space: string;
    }
  ) {}

  async bulkCreate(verdicts: Verdict[]) {
    return this.clients.dataStreamClient.create({
      space: this.clients.space,
      documents: verdicts,
    });
  }

  async search(options: CommonSearchOptions = {}): Promise<{ hits: Verdict[] }> {
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

export function fromStorage(stored: StoredVerdict): Verdict {
  return {
    '@timestamp': readScalar(stored['@timestamp']) as string,
    verdict: readScalar(stored.verdict) as string,
    verdict_id: readScalar(stored.verdict_id) as string,
    discovery_id: readScalar(stored.discovery_id) as string,
    discovery_slug: readScalar(stored.discovery_slug) as string,
    title: readScalar(stored.title) as string,
  };
}
