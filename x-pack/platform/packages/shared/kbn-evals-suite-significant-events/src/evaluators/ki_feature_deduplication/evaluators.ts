/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  hasSameFingerprint,
  isDuplicateFeature,
  type BaseFeature,
} from '@kbn/streams-schema';
import { uniqBy, uniqWith } from 'lodash';
import type { BoundInferenceClient } from '@kbn/inference-common';
import { executeUntilValid } from '@kbn/inference-prompt-utils';
import { SemanticUniquenessPrompt } from './semantic_uniqueness/prompt';

interface IterationOutput {
  features: BaseFeature[];
  previousFeatureCount: number;
}

interface DedupLoopOutput {
  iterations: IterationOutput[];
  finalFeatures: BaseFeature[];
  traceId?: string | null;
}

/**
 * ID re-use evaluator (CODE). When a feature returned in iteration N
 * matches (via isDuplicateFeature) something that was passed as
 * previouslyIdentifiedFeatures, it should re-use the same id.
 *
 * Score = correctly_reused / total_matches_to_previous.
 * A score of 1 means every time the LLM re-emitted a known feature,
 * it kept the original id.
 */
export const idReuseEvaluator = {
  name: 'id_reuse',
  kind: 'CODE' as const,
  evaluate: async ({ output }: { output: DedupLoopOutput }) => {
    const { iterations, finalFeatures } = output;

    if (iterations.length <= 1 || finalFeatures.length === 0) {
      return {
        score: null,
        explanation: 'Inconclusive: need at least 2 iterations to evaluate id reuse',
      };
    }

    let totalMatchesToPrevious = 0;
    let correctlyReused = 0;
    let accumulatedFeatures: BaseFeature[] = [];

    for (const iteration of iterations) {
      if (accumulatedFeatures.length === 0) {
        accumulatedFeatures = [...iteration.features];
        continue;
      }

      for (const feature of iteration.features) {
        const matchInPrevious = accumulatedFeatures.find((prev) =>
          isDuplicateFeature(prev, feature)
        );

        if (matchInPrevious) {
          totalMatchesToPrevious++;
          if (feature.id.toLowerCase() === matchInPrevious.id.toLowerCase()) {
            correctlyReused++;
          }
        }
      }

      for (const feature of iteration.features) {
        const existingIdx = accumulatedFeatures.findIndex((prev) =>
          isDuplicateFeature(prev, feature)
        );
        if (existingIdx >= 0) {
          accumulatedFeatures[existingIdx] = feature;
        } else {
          accumulatedFeatures.push(feature);
        }
      }
    }

    if (totalMatchesToPrevious === 0) {
      return {
        score: null,
        explanation: 'Inconclusive: no features matched previouslyIdentifiedFeatures across iterations',
      };
    }

    const score = correctlyReused / totalMatchesToPrevious;

    return {
      score,
      explanation: `${correctlyReused}/${totalMatchesToPrevious} re-emitted features used the correct id`,
      metadata: {
        total_matches_to_previous: totalMatchesToPrevious,
        correctly_reused: correctlyReused,
        mismatched: totalMatchesToPrevious - correctlyReused,
      },
    };
  },
};

/**
 * Checks that all unique-by-id KIs in the final accumulated set are
 * semantically distinct. Score = K / N, where K = semantic clusters
 * and N = unique ids. A score < 1 means there are semantic duplicates.
 */
export const createSemanticUniquenessEvaluator = ({
  inferenceClient,
}: {
  inferenceClient: BoundInferenceClient;
}) => ({
  name: 'llm_semantic_uniqueness',
  kind: 'LLM' as const,
  evaluate: async ({
    input,
    output,
  }: {
    input: { stream_name: string };
    output: DedupLoopOutput;
  }) => {
    const { finalFeatures } = output;

    if (finalFeatures.length === 0) {
      return { score: null, explanation: 'Inconclusive: no features to evaluate' };
    }

    const kisUniqueById = uniqBy(finalFeatures, (ki) => ki.id.toLowerCase());
    const uniqueById = kisUniqueById.length;
    const uniqueByFingerprint = uniqWith(kisUniqueById, hasSameFingerprint).length;

    const compactUniqueKIs = kisUniqueById.map((ki) => ({
      id: ki.id.toLowerCase(),
      type: ki.type,
      subtype: ki.subtype,
      title: ki.title,
      properties: ki.properties,
      description: ki.description?.slice(0, 300),
    }));

    const response = await executeUntilValid({
      prompt: SemanticUniquenessPrompt,
      inferenceClient,
      input: {
        stream_name: input?.stream_name,
        totals: JSON.stringify({
          total_kis: finalFeatures.length,
          unique_by_id: uniqueById,
          unique_by_fingerprint: uniqueByFingerprint,
        }),
        unique_kis_by_id: JSON.stringify(compactUniqueKIs),
      },
      finalToolChoice: { function: 'analyze' as const },
      maxRetries: 3,
      toolCallbacks: {
        analyze: async (toolCall) => {
          const { k, duplicate_clusters } = toolCall.function.arguments;

          if (!Number.isFinite(k) || k < 0 || k > uniqueById) {
            throw new Error(
              `Expected k to be a number between 0 and ${uniqueById}, got ${JSON.stringify(k)}`
            );
          }

          const knownIds = new Set(compactUniqueKIs.map((ki) => ki.id.toLowerCase()));
          for (const cluster of duplicate_clusters) {
            for (const id of cluster.ids ?? []) {
              if (!knownIds.has(id.toLowerCase())) {
                throw new Error(`duplicate_clusters references unknown KI id "${id}"`);
              }
            }
          }

          return { response: toolCall.function.arguments };
        },
      },
    });

    const { k, explanation, duplicate_clusters } = response.toolCalls[0].function.arguments;
    const score = uniqueById > 0 ? k / uniqueById : 1;

    return {
      score,
      explanation,
      metadata: {
        n: uniqueById,
        k,
        duplicate_rate: uniqueById > 0 ? 1 - k / uniqueById : 0,
        duplicate_clusters,
        unique_by_id: uniqueById,
        unique_by_fingerprint: uniqueByFingerprint,
      },
    };
  },
});
