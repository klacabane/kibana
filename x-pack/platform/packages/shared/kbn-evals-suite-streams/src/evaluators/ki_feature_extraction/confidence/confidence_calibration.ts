/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EvaluationCriterion, Evaluator } from '@kbn/evals';
import { createScenarioCriteriaLlmEvaluator } from '../../scenario_criteria/evaluators';
import type {
  KIFeatureExtractionEvaluationExample,
  KIFeatureExtractionOutput,
} from '../types';
import { getFeaturesFromOutput } from '../types';

const CONFIDENCE_CALIBRATION_CRITERIA: EvaluationCriterion[] = [
  {
    id: 'confidence_calibration',
    text: 'Confidence values should reflect evidence directness. Features backed by explicit, unambiguous identifiers (service name labels, namespace, container image tags) may claim high confidence. Features inferred indirectly (dependencies inferred from log messages, schemas inferred from field structure, technologies guessed from stack traces) should have lower confidence. Features with weak or indirect evidence should not claim confidence=100.',
    score: 1,
  },
];

/**
 * LLM-judged evaluator that checks whether confidence values are calibrated
 * relative to the directness and strength of the evidence provided.
 * Runs independently from scenario_criteria so both signals can be tracked
 * and tuned separately.
 */
export const createConfidenceCalibrationEvaluator = ({
  criteriaFn,
}: {
  criteriaFn: (criteria: EvaluationCriterion[]) => Evaluator;
}): Evaluator<KIFeatureExtractionEvaluationExample, KIFeatureExtractionOutput> =>
  createScenarioCriteriaLlmEvaluator<
    KIFeatureExtractionEvaluationExample,
    KIFeatureExtractionOutput
  >({
    name: 'confidence_calibration',
    criteriaFn: (c) =>
      criteriaFn(c) as Evaluator<KIFeatureExtractionEvaluationExample, KIFeatureExtractionOutput>,
    criteria: CONFIDENCE_CALIBRATION_CRITERIA,
    transformOutput: (output) => getFeaturesFromOutput(output),
  });
