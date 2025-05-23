/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import * as TaskEither from 'fp-ts/TaskEither';
import * as Either from 'fp-ts/Either';
import type { ElasticsearchClient } from '@kbn/core-elasticsearch-server';
import type { IndexMapping } from '@kbn/core-saved-objects-base-server-internal';
import {
  catchRetryableEsClientErrors,
  type RetryableEsClientError,
} from './catch_retryable_es_client_errors';

export type FetchIndexResponse = Record<
  string,
  { aliases: Record<string, unknown>; mappings: IndexMapping; settings: unknown }
>;

/** @internal */
export interface FetchIndicesParams {
  client: ElasticsearchClient;
  indices: string[];
}

/**
 * Fetches information about the given indices including aliases, mappings and
 * settings.
 */
export const fetchIndices =
  ({
    client,
    indices,
  }: FetchIndicesParams): TaskEither.TaskEither<RetryableEsClientError, FetchIndexResponse> =>
  () => {
    return client.indices
      .get({
        index: indices,
        ignore_unavailable: true, // Don't return an error for missing indices. Note this *will* include closed indices, the docs are misleading https://github.com/elastic/elasticsearch/issues/63607
      })
      .then((body) => {
        return Either.right(body as FetchIndexResponse);
      })
      .catch(catchRetryableEsClientErrors);
  };
