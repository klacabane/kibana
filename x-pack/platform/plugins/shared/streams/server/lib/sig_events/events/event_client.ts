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
import { DISCOVERY_ID, TIMESTAMP, VERDICT } from './fields';
import { type StoredEvent, type eventsMappings } from './data_stream';

export interface SigEvent {
  '@timestamp': string;
  event_id: string;
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

export type EventDataStreamClient = IDataStreamClient<typeof eventsMappings, StoredEvent>;

export class EventClient {
  constructor(
    private readonly clients: {
      dataStreamClient: EventDataStreamClient;
      logger: Logger;
      space: string;
    }
  ) {}

  async bulkCreate(events: SigEvent[]): Promise<{ created: number }> {
    if (events.length === 0) {
      return { created: 0 };
    }

    const documents = events.map(toStorage);

    const response = await this.clients.dataStreamClient.create({
      space: this.clients.space,
      documents,
    });
    const { failed, total } = summarizeBulkErrors(response);

    if (failed > 0) {
      this.clients.logger.error(`Failed to create ${failed}/${total} events`, {
        tags: ['events'],
      });
    }

    return { created: documents.length };
  }

  async findByVerdict(
    verdict: string,
    options: FindOptions = {}
  ): Promise<{ hits: SigEvent[]; total: number }> {
    return this.search([...termQuery(VERDICT, verdict)], options);
  }

  async findByDiscoveryId(
    discoveryId: string,
    options: FindOptions = {}
  ): Promise<{ hits: SigEvent[]; total: number }> {
    return this.search([...termQuery(DISCOVERY_ID, discoveryId)], options);
  }

  async exists(): Promise<boolean> {
    return this.clients.dataStreamClient.exists();
  }

  private async search(
    baseFilters: QueryDslQueryContainer[],
    options: FindOptions
  ): Promise<{ hits: SigEvent[]; total: number }> {
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

export function toStorage(event: SigEvent): StoredEvent {
  return {
    '@timestamp': event['@timestamp'],
    event_id: event.event_id,
    verdict: event.verdict,
    verdict_id: event.verdict_id,
    discovery_id: event.discovery_id,
    discovery_slug: event.discovery_slug,
    title: event.title,
  } as StoredEvent;
}

export function fromStorage(stored: StoredEvent): SigEvent {
  return {
    '@timestamp': readScalar(stored['@timestamp']) as string,
    event_id: readScalar(stored.event_id) as string,
    verdict: readScalar(stored.verdict) as string,
    verdict_id: readScalar(stored.verdict_id) as string,
    discovery_id: readScalar(stored.discovery_id) as string,
    discovery_slug: readScalar(stored.discovery_slug) as string,
    title: readScalar(stored.title) as string,
  };
}
