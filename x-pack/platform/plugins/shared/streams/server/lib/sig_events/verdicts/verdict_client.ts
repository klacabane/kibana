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
import { DISCOVERY_ID, TIMESTAMP } from './fields';
import { type StoredVerdict, type verdictsMappings } from './data_stream';

export interface Verdict {
  '@timestamp': string;
  verdict: string;
  verdict_id: string;
  discovery_id: string;
  discovery_slug: string;
  title: string;
}

export interface FindOptions {
  size?: number;
  from?: string | number;
  to?: string | number;
  sortOrder?: SortOrder;
}

const DEFAULT_PAGE_SIZE = 1_000;

export type VerdictDataStreamClient = IDataStreamClient<typeof verdictsMappings, StoredVerdict>;

export class VerdictClient {
  constructor(
    private readonly clients: {
      dataStreamClient: VerdictDataStreamClient;
      logger: Logger;
      space: string;
    }
  ) {}

  async bulkCreate(verdicts: Verdict[]): Promise<{ created: number }> {
    if (verdicts.length === 0) {
      return { created: 0 };
    }

    const documents = verdicts.map(toStorage);

    const response = await this.clients.dataStreamClient.create({
      space: this.clients.space,
      documents,
    });
    const { failed, total } = summarizeBulkErrors(response);

    if (failed > 0) {
      this.clients.logger.error(`Failed to create ${failed}/${total} verdicts`, {
        tags: ['verdicts'],
      });
    }

    return { created: documents.length };
  }

  async findByDiscoveryId(
    discoveryId: string,
    options: FindOptions = {}
  ): Promise<{ hits: Verdict[]; total: number }> {
    return this.search([...termQuery(DISCOVERY_ID, discoveryId)], options);
  }

  async exists(): Promise<boolean> {
    return this.clients.dataStreamClient.exists();
  }

  private async search(
    baseFilters: QueryDslQueryContainer[],
    options: FindOptions
  ): Promise<{ hits: Verdict[]; total: number }> {
    const { size = DEFAULT_PAGE_SIZE, from, to, sortOrder = 'desc' } = options;
    const filters: QueryDslQueryContainer[] = [...baseFilters];

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
}

export function toStorage(verdict: Verdict): StoredVerdict {
  return {
    '@timestamp': verdict['@timestamp'],
    verdict: verdict.verdict,
    verdict_id: verdict.verdict_id,
    discovery_id: verdict.discovery_id,
    discovery_slug: verdict.discovery_slug,
    title: verdict.title,
  } as StoredVerdict;
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
