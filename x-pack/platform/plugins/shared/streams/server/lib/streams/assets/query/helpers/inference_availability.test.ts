/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import { loggerMock } from '@kbn/logging-mocks';
import { defaultInferenceEndpoints } from '@kbn/inference-common';
import { createInferenceResolver } from './inference_availability';

const EIS_ID = defaultInferenceEndpoints.ELSER_IN_EIS_INFERENCE_ID;
const SELF_MANAGED_ID = defaultInferenceEndpoints.ELSER;

const createMockEsClient = (probeResponses: Record<string, 'ok' | 'fail'>): ElasticsearchClient => {
  return {
    inference: {
      inference: jest.fn(({ inference_id: id }: { inference_id: string }) => {
        if (probeResponses[id] === 'ok') {
          return Promise.resolve({ inference_results: [] });
        }
        return Promise.reject(new Error(`Inference endpoint "${id}" not available`));
      }),
    },
  } as unknown as ElasticsearchClient;
};

const createMockLogger = () => loggerMock.create();

describe('createInferenceResolver', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the EIS endpoint when it is available', async () => {
    const logger = createMockLogger();
    const resolve = createInferenceResolver(logger);
    const esClient = createMockEsClient({ [EIS_ID]: 'ok', [SELF_MANAGED_ID]: 'ok' });

    const result = await resolve(esClient);

    expect(result).toEqual({ inferenceId: EIS_ID, available: true });
    expect(esClient.inference.inference).toHaveBeenCalledTimes(1);
    expect(esClient.inference.inference).toHaveBeenCalledWith({
      inference_id: EIS_ID,
      input: 'test',
    });
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(EIS_ID));
  });

  it('falls back to the self-managed endpoint when EIS is unavailable', async () => {
    const logger = createMockLogger();
    const resolve = createInferenceResolver(logger);
    const esClient = createMockEsClient({ [EIS_ID]: 'fail', [SELF_MANAGED_ID]: 'ok' });

    const result = await resolve(esClient);

    expect(result).toEqual({ inferenceId: SELF_MANAGED_ID, available: true });
    expect(esClient.inference.inference).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(SELF_MANAGED_ID));
  });

  it('returns the preferred EIS ID with available: false when no endpoint works', async () => {
    const logger = createMockLogger();
    const resolve = createInferenceResolver(logger);
    const esClient = createMockEsClient({ [EIS_ID]: 'fail', [SELF_MANAGED_ID]: 'fail' });

    const result = await resolve(esClient);

    expect(result).toEqual({ inferenceId: EIS_ID, available: false });
    expect(esClient.inference.inference).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith('No ELSER inference endpoint available');
  });

  it('returns cached result on subsequent calls within TTL', async () => {
    const logger = createMockLogger();
    const resolve = createInferenceResolver(logger);
    const esClient = createMockEsClient({ [EIS_ID]: 'ok' });

    const first = await resolve(esClient);
    const second = await resolve(esClient);

    expect(first).toEqual(second);
    expect(esClient.inference.inference).toHaveBeenCalledTimes(1);
  });

  it('re-probes after the 5-minute TTL expires', async () => {
    const logger = createMockLogger();
    const resolve = createInferenceResolver(logger);
    const esClient = createMockEsClient({ [EIS_ID]: 'ok' });

    await resolve(esClient);
    expect(esClient.inference.inference).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    await resolve(esClient);
    expect(esClient.inference.inference).toHaveBeenCalledTimes(2);
  });

  it('caches negative results to avoid hammering endpoints', async () => {
    const logger = createMockLogger();
    const resolve = createInferenceResolver(logger);
    const esClient = createMockEsClient({ [EIS_ID]: 'fail', [SELF_MANAGED_ID]: 'fail' });

    const first = await resolve(esClient);
    expect(first.available).toBe(false);
    expect(esClient.inference.inference).toHaveBeenCalledTimes(2);

    const second = await resolve(esClient);
    expect(second.available).toBe(false);
    expect(esClient.inference.inference).toHaveBeenCalledTimes(2);
  });

  it('works without a logger', async () => {
    const logger = createMockLogger();
    const resolve = createInferenceResolver(logger);
    const esClient = createMockEsClient({ [EIS_ID]: 'ok' });

    const result = await resolve(esClient);
    expect(result).toEqual({ inferenceId: EIS_ID, available: true });
  });

  it('reflects a change in availability after cache expires', async () => {
    const logger = createMockLogger();
    const resolve = createInferenceResolver(logger);
    const esClient = createMockEsClient({ [EIS_ID]: 'fail', [SELF_MANAGED_ID]: 'fail' });

    const first = await resolve(esClient);
    expect(first.available).toBe(false);

    (esClient.inference.inference as jest.Mock).mockImplementation(
      ({ inference_id: id }: { inference_id: string }) => {
        if (id === EIS_ID) return Promise.resolve({ inference_results: [] });
        return Promise.reject(new Error('not available'));
      }
    );

    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    const second = await resolve(esClient);
    expect(second).toEqual({ inferenceId: EIS_ID, available: true });
  });

  it('isolates cache between separate resolver instances', async () => {
    const logger = createMockLogger();
    const resolverA = createInferenceResolver(logger);
    const resolverB = createInferenceResolver(logger);
    const esClient = createMockEsClient({ [EIS_ID]: 'ok' });

    await resolverA(esClient);
    await resolverB(esClient);

    expect(esClient.inference.inference).toHaveBeenCalledTimes(2);
  });
});
