/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { Transaction } from 'elastic-apm-node';
import { ElasticsearchClient } from '@kbn/core/server';
import { Asset } from '../../../../common/types_api';

export const QUERY_MAX_SIZE = 10000;

export interface CollectorOptions {
  client: ElasticsearchClient;
  from: number | string;
  to?: number | string;
  afterKey?: { [key: string]: string };
  transaction: Transaction | null;
}

export interface CollectorResult {
  assets: Asset[];
  afterKey?: { [key: string]: string };
}

export type Collector = (opts: CollectorOptions) => Promise<CollectorResult>;

export { collectContainers } from './containers';
export { collectHosts } from './hosts';
export { collectPods } from './pods';
export { collectServices } from './services';
