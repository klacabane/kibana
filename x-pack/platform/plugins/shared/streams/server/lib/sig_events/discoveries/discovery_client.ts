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
import { type StoredDiscovery, type discoveriesMappings } from './data_stream';

export interface Discovery {
  '@timestamp': string;
  discovery_id: string;
  discovery_slug: string;
  status: string;
  title: string;
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

  async search(options: CommonSearchOptions = {}): Promise<{ hits: Discovery[] }> {
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

export function fromStorage(stored: StoredDiscovery): Discovery {
  return {
    '@timestamp': readScalar(stored['@timestamp']) as string,
    discovery_id: readScalar(stored.discovery_id) as string,
    discovery_slug: readScalar(stored.discovery_slug) as string,
    status: readScalar(stored.status) as string,
    title: readScalar(stored.title) as string,
  };
}
