/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient, Logger } from '@kbn/core/server';
import { errors, type DiagnosticResult } from '@elastic/elasticsearch';
import { checkInferenceAvailability, getElserInferenceId } from './inference_availability';

const createMockLogger = (): jest.Mocked<Pick<Logger, 'warn'>> => ({
  warn: jest.fn(),
});

const createResponseError = (
  statusCode: number,
  body: Record<string, unknown> = {}
): errors.ResponseError =>
  new errors.ResponseError({
    statusCode,
    body,
    headers: {},
    warnings: [],
    meta: {
      aborted: false,
      attempts: 1,
      connection: null,
      context: null,
      name: 'test',
      request: {} as unknown as DiagnosticResult['meta']['request'],
    },
  });

describe('getElserInferenceId', () => {
  it('returns the self-managed endpoint for non-serverless', () => {
    expect(getElserInferenceId(false)).toBe('.elser-2-elasticsearch');
  });

  it('returns the EIS endpoint for serverless', () => {
    expect(getElserInferenceId(true)).toBe('.elser-2-elastic');
  });
});

describe('checkInferenceAvailability', () => {
  it('returns true when the inference endpoint exists', async () => {
    const esClient = {
      inference: {
        get: jest
          .fn()
          .mockResolvedValue({ endpoints: [{ inference_id: '.elser-2-elasticsearch' }] }),
      },
    } as unknown as ElasticsearchClient;

    const result = await checkInferenceAvailability(esClient, '.elser-2-elasticsearch');
    expect(result).toBe(true);
    expect(esClient.inference.get).toHaveBeenCalledWith({
      inference_id: '.elser-2-elasticsearch',
    });
  });

  it('returns false without logging when the inference endpoint does not exist (404)', async () => {
    const esClient = {
      inference: {
        get: jest.fn().mockRejectedValue(createResponseError(404)),
      },
    } as unknown as ElasticsearchClient;
    const logger = createMockLogger();

    const result = await checkInferenceAvailability(
      esClient,
      '.elser-2-elasticsearch',
      logger as unknown as Logger
    );
    expect(result).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns false and logs a warning for non-404 errors', async () => {
    const esClient = {
      inference: {
        get: jest.fn().mockRejectedValue(createResponseError(500)),
      },
    } as unknown as ElasticsearchClient;
    const logger = createMockLogger();

    const result = await checkInferenceAvailability(
      esClient,
      '.elser-2-elasticsearch',
      logger as unknown as Logger
    );
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('check failed (status 500)'));
  });

  it('returns false and logs a warning for network errors without statusCode', async () => {
    const esClient = {
      inference: {
        get: jest.fn().mockRejectedValue(new Error('Connection refused')),
      },
    } as unknown as ElasticsearchClient;
    const logger = createMockLogger();

    const result = await checkInferenceAvailability(
      esClient,
      '.elser-2-elasticsearch',
      logger as unknown as Logger
    );
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
  });

  it('returns false without crashing when no logger is provided', async () => {
    const esClient = {
      inference: {
        get: jest.fn().mockRejectedValue(new Error('Connection refused')),
      },
    } as unknown as ElasticsearchClient;

    const result = await checkInferenceAvailability(esClient, '.elser-2-elasticsearch');
    expect(result).toBe(false);
  });
});
