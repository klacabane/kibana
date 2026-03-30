/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KIFeatureExtractionEvaluator } from '../types';
import { getFeaturesFromOutput } from '../types';

/**
 * If max_confidence is specified, verifies no KI exceeds it.
 */
export const confidenceBoundsEvaluator = {
  name: 'confidence_bounds',
  kind: 'CODE' as const,
  evaluate: async ({ output, expected }) => {
    const { max_confidence = 100 } = expected;

    const features = getFeaturesFromOutput(output);
    if (features.length === 0) {
      return {
        score: null,
        explanation: 'No KI features emitted',
      };
    }

    const violations = features.filter((feature) => feature.confidence > max_confidence);

    return {
      score: violations.length === 0 ? 1 : 1 - violations.length / features.length,
      explanation:
        violations.length > 0
          ? `${violations.length}/${
              features.length
            } KI features exceed max confidence ${max_confidence}: ${violations
              .map((feature) => `"${feature.id}" (${feature.confidence})`)
              .join(', ')}`
          : `All KI features have confidence ≤ ${max_confidence}`,
      details: {
        max_confidence,
        violations: violations.map((feature) => ({
          id: feature.id,
          confidence: feature.confidence,
        })),
      },
    };
  },
} satisfies KIFeatureExtractionEvaluator;
