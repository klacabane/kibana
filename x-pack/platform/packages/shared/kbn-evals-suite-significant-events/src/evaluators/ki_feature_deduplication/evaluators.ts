/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { hasSameFingerprint, isDuplicateFeature, type BaseFeature } from '@kbn/streams-schema';
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
 * Structural dedup evaluator (CODE).
 * Checks that the final accumulated feature set has no structural duplicates
 * (different ids sharing the same fingerprint).
 * Score = 1 - (missed_duplicates / unique_by_id).
 */
export const structuralEvaluator = {
  name: 'structural',
  kind: 'CODE' as const,
  evaluate: async ({ output }: { output: DedupLoopOutput }) => {
    const { finalFeatures } = output;

    if (finalFeatures.length === 0) {
      return { score: null, explanation: 'Inconclusive: no features produced' };
    }

    const uniqueById = uniqBy(finalFeatures, (f) => f.id.toLowerCase());
    const uniqueByFingerprint = uniqWith(uniqueById, hasSameFingerprint);
    const missedDuplicates = uniqueById.length - uniqueByFingerprint.length;

    const structuralDuplicateGroups = uniqueByFingerprint
      .map((representative) => ({
        ids: uniqueById
          .filter((f) => hasSameFingerprint(f, representative))
          .map((f) => f.id.toLowerCase()),
        type: representative.type,
        subtype: representative.subtype,
        properties: representative.properties,
      }))
      .filter((group) => group.ids.length > 1);

    const score = uniqueById.length > 0 ? Math.max(0, 1 - missedDuplicates / uniqueById.length) : 1;

    return {
      score,
      metadata: {
        total_final_features: finalFeatures.length,
        unique_by_id: uniqueById.length,
        unique_by_fingerprint: uniqueByFingerprint.length,
        missed_duplicates: missedDuplicates,
        structural_duplicate_groups: structuralDuplicateGroups,
      },
    };
  },
};

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
 * Discovery rate evaluator (CODE). Tracks how many genuinely new features
 * appear in each iteration (not matching any previously accumulated feature).
 * A healthy loop should discover new features in at least some later iterations.
 *
 * Score = iterations_with_new_features / total_iterations.
 */
export const discoveryRateEvaluator = {
  name: 'discovery_rate',
  kind: 'CODE' as const,
  evaluate: async ({ output }: { output: DedupLoopOutput }) => {
    const { iterations } = output;

    if (iterations.length === 0) {
      return { score: null, explanation: 'Inconclusive: no iterations' };
    }

    let accumulatedFeatures: BaseFeature[] = [];
    const perIterationStats: Array<{ iteration: number; newFeatures: number; totalFeatures: number }> = [];

    for (let i = 0; i < iterations.length; i++) {
      const { features } = iterations[i];
      let newCount = 0;

      for (const feature of features) {
        const isKnown = accumulatedFeatures.some((prev) => isDuplicateFeature(prev, feature));
        if (!isKnown) {
          newCount++;
          accumulatedFeatures.push(feature);
        } else {
          const idx = accumulatedFeatures.findIndex((prev) => isDuplicateFeature(prev, feature));
          if (idx >= 0) {
            accumulatedFeatures[idx] = feature;
          }
        }
      }

      perIterationStats.push({
        iteration: i,
        newFeatures: newCount,
        totalFeatures: features.length,
      });
    }

    const iterationsWithNewFeatures = perIterationStats.filter((s) => s.newFeatures > 0).length;
    const score = iterationsWithNewFeatures / iterations.length;

    return {
      score,
      explanation: `${iterationsWithNewFeatures}/${iterations.length} iterations discovered new features`,
      metadata: {
        per_iteration: perIterationStats,
        total_accumulated: accumulatedFeatures.length,
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
