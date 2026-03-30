/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SearchHit } from '@elastic/elasticsearch/lib/api/types';
import type { BaseFeature } from '@kbn/streams-schema';
import { createKIFeatureExtractionEvaluators } from './evaluators';

const evidenceGroundingEvaluator = createKIFeatureExtractionEvaluators().find(
  (evaluator) => evaluator.name === 'evidence_grounding'
);
const kiFeatureCountEvaluator = createKIFeatureExtractionEvaluators().find(
  (evaluator) => evaluator.name === 'ki_feature_count'
);
const filterPresenceEvaluator = createKIFeatureExtractionEvaluators().find(
  (evaluator) => evaluator.name === 'filter_presence'
);

const createSearchHit = (source: Record<string, unknown>): SearchHit<Record<string, unknown>> => ({
  _index: 'test-index',
  _id: 'doc-1',
  _source: source,
});

const createKI = (feature: Omit<BaseFeature, 'stream_name' | 'properties'>): BaseFeature => ({
  ...feature,
  stream_name: 'test-stream',
  properties: {},
});

const createKIs = (count: number): BaseFeature[] =>
  Array.from({ length: count }, (_, index) =>
    createKI({
      id: `entity-${index}`,
      type: 'entity',
      description: `entity ${index}`,
      confidence: 80,
    })
  );

describe('evidence grounding evaluator', () => {
  it('does not treat short evidence as grounded by substring matches inside larger words', async () => {
    const result = await evidenceGroundingEvaluator!.evaluate({
      input: {
        sample_documents: [
          createSearchHit({
            message: 'Request TARGET completed',
          }),
        ],
      },
      output: {
        features: [
          createKI({
            id: 'entity-frontend',
            type: 'entity',
            description: 'frontend service',
            confidence: 80,
            evidence: ['GET'],
          }),
        ],
      },
      expected: {
        criteria: [],
        expected_ground_truth: '',
      },
      metadata: null,
    });

    expect(result.score).toBe(0);
    expect(result.explanation).toContain('"GET"');
  });

  it('still grounds short evidence when it appears as its own token', async () => {
    const result = await evidenceGroundingEvaluator!.evaluate({
      input: {
        sample_documents: [
          createSearchHit({
            message: 'GET /api/cart returned 200',
          }),
        ],
      },
      output: {
        features: [
          createKI({
            id: 'entity-cart',
            type: 'entity',
            description: 'cart service',
            confidence: 80,
            evidence: ['GET'],
          }),
        ],
      },
      expected: {
        criteria: [],
        expected_ground_truth: '',
      },
      metadata: null,
    });

    expect(result.score).toBe(1);
  });

  it('grounds evidence with trailing "..." by matching the prefix', async () => {
    const result = await evidenceGroundingEvaluator!.evaluate({
      input: {
        sample_documents: [
          createSearchHit({
            body: { text: '[PlaceOrder] user_id=abc123 req_id=xyz987' },
          }),
        ],
      },
      output: {
        features: [
          createKI({
            id: 'checkout-service',
            type: 'entity',
            description: 'checkout service',
            confidence: 80,
            evidence: ['body.text=[PlaceOrder] user_id=...'],
          }),
        ],
      },
      expected: { criteria: [], expected_ground_truth: '' },
      metadata: null,
    });

    expect(result.score).toBe(1);
  });

  it('penalizes features with empty evidence arrays', async () => {
    const result = await evidenceGroundingEvaluator!.evaluate({
      input: {
        sample_documents: [
          createSearchHit({
            body: { text: 'some log message' },
          }),
        ],
      },
      output: {
        features: [
          createKI({
            id: 'entity-with-evidence',
            type: 'entity',
            description: 'grounded entity',
            confidence: 80,
            evidence: ['some log message'],
          }),
          createKI({
            id: 'entity-no-evidence',
            type: 'entity',
            description: 'entity with no evidence',
            confidence: 80,
            evidence: [],
          }),
        ],
      },
      expected: { criteria: [], expected_ground_truth: '' },
      metadata: null,
    });

    // 1 grounded + 1 empty-evidence penalty = 1/2
    expect(result.score).toBe(0.5);
    expect(result.explanation).toContain('no evidence provided');
  });

  it('supports array index paths in key value evidence', async () => {
    const result = await evidenceGroundingEvaluator!.evaluate({
      input: {
        sample_documents: [
          createSearchHit({
            labels: [{ key: 'deployment.environment', value: 'production' }],
          }),
        ],
      },
      output: {
        features: [
          createKI({
            id: 'infra-kubernetes',
            type: 'infrastructure',
            description: 'runtime environment',
            confidence: 90,
            evidence: ['labels.0.key=deployment.environment'],
          }),
        ],
      },
      expected: {
        criteria: [],
        expected_ground_truth: '',
      },
      metadata: null,
    });

    expect(result.score).toBe(1);
  });
});

describe('filter_presence evaluator', () => {
  const makeDoc = (source: Record<string, unknown>) =>
    createSearchHit(source);

  it('scores 0 for entities missing a filter', async () => {
    const result = await filterPresenceEvaluator!.evaluate({
      input: { sample_documents: [makeDoc({ 'service.name': 'frontend' })] },
      output: {
        features: [
          createKI({ id: 'entity-frontend', type: 'entity', description: 'frontend', confidence: 80 }),
        ],
      },
      expected: { criteria: [], expected_ground_truth: '', expect_entity_filters: true },
      metadata: null,
    });

    expect(result.score).toBe(0);
    expect(result.explanation).toContain('no filter');
  });

  it('scores 1 for a fully grounded eq filter', async () => {
    const result = await filterPresenceEvaluator!.evaluate({
      input: { sample_documents: [makeDoc({ 'service.name': 'frontend' })] },
      output: {
        features: [
          createKI({
            id: 'entity-frontend',
            type: 'entity',
            description: 'frontend',
            confidence: 80,
            filter: { field: 'service.name', eq: 'frontend' },
          }),
        ],
      },
      expected: { criteria: [], expected_ground_truth: '', expect_entity_filters: true },
      metadata: null,
    });

    expect(result.score).toBe(1);
    expect(result.explanation).toContain('grounded');
  });

  it('scores 0.5 for a filter with an ungrounded eq value', async () => {
    const result = await filterPresenceEvaluator!.evaluate({
      input: { sample_documents: [makeDoc({ 'service.name': 'frontend' })] },
      output: {
        features: [
          createKI({
            id: 'entity-checkout',
            type: 'entity',
            description: 'checkout',
            confidence: 80,
            filter: { field: 'service.name', eq: 'checkout' },
          }),
        ],
      },
      expected: { criteria: [], expected_ground_truth: '', expect_entity_filters: true },
      metadata: null,
    });

    // has filter (0.5) + 0 grounded pairs out of 1 (0.0) = 0.5
    expect(result.score).toBe(0.5);
    expect(result.explanation).toContain('service.name=checkout');
  });

  it('scores 1 for a filter using only non-eq operators (unverifiable)', async () => {
    const result = await filterPresenceEvaluator!.evaluate({
      input: { sample_documents: [makeDoc({ 'http.response.status_code': 500 })] },
      output: {
        features: [
          createKI({
            id: 'entity-errors',
            type: 'entity',
            description: 'error responses',
            confidence: 80,
            filter: { field: 'http.response.status_code', gte: 500 },
          }),
        ],
      },
      expected: { criteria: [], expected_ground_truth: '', expect_entity_filters: true },
      metadata: null,
    });

    expect(result.score).toBe(1);
  });

  it('handles AND conditions and partially grounds them', async () => {
    const result = await filterPresenceEvaluator!.evaluate({
      input: {
        sample_documents: [
          makeDoc({ 'service.name': 'frontend', 'span.kind': 'server' }),
        ],
      },
      output: {
        features: [
          createKI({
            id: 'entity-frontend',
            type: 'entity',
            description: 'frontend',
            confidence: 80,
            filter: {
              and: [
                { field: 'service.name', eq: 'frontend' },   // grounded
                { field: 'service.name', eq: 'wrong-value' }, // not grounded
              ],
            },
          }),
        ],
      },
      expected: { criteria: [], expected_ground_truth: '', expect_entity_filters: true },
      metadata: null,
    });

    // 0.5 + 0.5 * (1/2) = 0.75
    expect(result.score).toBe(0.75);
  });

  it('skips evaluation when expect_entity_filters is not set', async () => {
    const result = await filterPresenceEvaluator!.evaluate({
      input: { sample_documents: [] },
      output: { features: [] },
      expected: { criteria: [], expected_ground_truth: '' },
      metadata: null,
    });

    expect(result.score).toBeNull();
  });
});

describe('ki_feature_count evaluator', () => {
  it('returns full credit when the KI count is within bounds', async () => {
    const result = await kiFeatureCountEvaluator!.evaluate({
      input: {
        sample_documents: [],
      },
      output: {
        features: createKIs(5),
      },
      expected: {
        criteria: [],
        expected_ground_truth: '',
        min_features: 3,
        max_features: 6,
      },
      metadata: null,
    });

    expect(result.score).toBe(1);
  });

  it('penalizes counts proportionally when below the minimum', async () => {
    const result = await kiFeatureCountEvaluator!.evaluate({
      input: {
        sample_documents: [],
      },
      output: {
        features: createKIs(2),
      },
      expected: {
        criteria: [],
        expected_ground_truth: '',
        min_features: 4,
      },
      metadata: null,
    });

    expect(result.score).toBe(0.5);
    expect(result.explanation).toContain('score=0.50');
  });

  it('penalizes counts proportionally when above the maximum', async () => {
    const result = await kiFeatureCountEvaluator!.evaluate({
      input: {
        sample_documents: [],
      },
      output: {
        features: createKIs(12),
      },
      expected: {
        criteria: [],
        expected_ground_truth: '',
        max_features: 10,
      },
      metadata: null,
    });

    expect(result.score).toBe(0.8);
    expect(result.explanation).toContain('score=0.80');
  });
});
