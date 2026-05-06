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
import { DISCOVERY_ID, TIMESTAMP } from './fields';
import { type StoredDiscovery, type discoveriesMappings } from './data_stream';

export interface Discovery {
  '@timestamp': string;
  discovery_id: string;
  discovery_slug: string;
  status: string;
  title: string;
}

export interface FindOptions {
  size?: number;
  from?: string | number;
  to?: string | number;
  sortOrder?: SortOrder;
}

const DEFAULT_PAGE_SIZE = 1_000;

export type DiscoveryDataStreamClient = IDataStreamClient<
  typeof discoveriesMappings,
  StoredDiscovery
>;

export class DiscoveryClient {
  constructor(
    private readonly clients: {
      dataStreamClient: DiscoveryDataStreamClient;
      space: string;
    }
  ) {}

  async bulkCreate(discoveries: Discovery[]) {
    return this.clients.dataStreamClient.create({
      space: this.clients.space,
      documents: discoveries,
    });
  }

  async findByDiscoveryId(
    discoveryId: string,
    options: FindOptions = {}
  ): Promise<{ hits: Discovery[] }> {
    return this.search([...termQuery(DISCOVERY_ID, discoveryId)], options);
  }

  private async search(
    baseFilters: QueryDslQueryContainer[],
    options: FindOptions
  ): Promise<{ hits: Discovery[] }> {
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
      _source: true,
      query: { bool: { filter: filters } },
      sort: [{ [TIMESTAMP]: { order: sortOrder } }],
    });

    return {
      hits: response.hits.hits.map((hit) => fromStorage(hit._source!)),
    };
  }
}

export function fromStorage(stored: StoredDiscovery): Discovery {
  return {
    '@timestamp': readScalar(stored['@timestamp']) as string,
    discovery_id: readScalar(stored.discovery_id) as string,
    discovery_slug: readScalar(stored.discovery_slug) as string,
    status: readScalar(stored.status) as string,
    title: readScalar(stored.title) as string,
  };
}
