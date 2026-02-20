/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Path from 'path';
import { node } from 'execa';
import { REPO_ROOT } from '@kbn/repo-info';
import kbnDatemath from '@kbn/datemath';
import { getSampleDocuments } from '@kbn/ai-tools';
import type { ScoutTestConfig } from '@kbn/scout';
import { tags } from '@kbn/scout';
import type { BaseFeature } from '@kbn/streams-schema';
import { identifyFeatures } from '@kbn/streams-ai';
import { featuresPrompt } from '@kbn/streams-ai/src/features/prompt';
import { uniqBy } from 'lodash';
import objectHash from 'object-hash';
import { ElasticsearchClient } from '@kbn/core/server';
import { BoundInferenceClient } from '@kbn/inference-common';
import { evaluate } from '../src/evaluate';
import { FEATURES_DUPLICATION_DATASETS } from './features_duplication_datasets';

evaluate.describe.configure({ timeout: 600_000 });

evaluate.describe('Streams features duplication (harness)', () => {
  const from = kbnDatemath.parse('now-10m')!;
  const to = kbnDatemath.parse('now')!;

  function getSharedArgs({ config }: { config: ScoutTestConfig }) {
    const esUrl = new URL(config.hosts.elasticsearch);
    const kbnUrl = new URL(config.hosts.kibana);

    esUrl.username = config.auth.username;
    esUrl.password = config.auth.password;

    kbnUrl.username = config.auth.username;
    kbnUrl.password = config.auth.password;

    return [
      `--from=${from.toISOString()}`,
      `--to=${to.toISOString()}`,
      `--kibana=${kbnUrl.toString()}`,
      `--target=${esUrl.toString()}`,
      '--assume-package-version=9.2.0',
      '--workers=1',
    ];
  }

  const synthtraceScript = Path.join(REPO_ROOT, 'scripts/synthtrace.js');

  async function indexLogs({
    scenario,
    config,
  }: {
    scenario: string;
    config: ScoutTestConfig;
  }) {
    await node(
      require.resolve(synthtraceScript),
      [
        scenario,
        ...getSharedArgs({ config }),
      ],
      { stdio: 'inherit' }
    );
  }

  async function runRepeatedFeatureIdentification({
    esClient,
    streamName,
    runs,
    inferenceClient,
    logger,
  }: {
    esClient: ElasticsearchClient;
    streamName: string;
    runs: number;
    inferenceClient: BoundInferenceClient;
    logger: any;
  }): Promise<{
    runs: Array<{
      features: BaseFeature[];
    }>;
  }> {
    const outputs: Array<{ features: BaseFeature[] }> = [];

    for (let i = 0; i < runs; i++) {
      const { hits: sampleDocuments } = await getSampleDocuments({
        esClient,
        index: streamName,
        size: 20,
        start: from.valueOf(),
        end: to.valueOf(),
      });

      const { features } = await identifyFeatures({
        streamName,
        sampleDocuments,
        systemPrompt: featuresPrompt,
        inferenceClient,
        logger,
        signal: new AbortController().signal,
      });

      outputs.push({ features });
    }

    return { runs: outputs };
  }

  function featureFingerprint(feature: BaseFeature): string {
    return objectHash({
      type: feature.type,
      subtype: feature.subtype,
      properties: feature.properties,
    });
  }

  /**
   * Checks that all unique-by-id features are semantically distinct.
   * Score = K / N, where K = semantic clusters and N = unique ids.
   * A score < 1 means there are semantic duplicates in the feature set.
   */
  function semanticUniquenessLlmEvaluator(evaluators: any) {
    return {
      name: 'llm_semantic_uniqueness',
      kind: 'LLM' as const,
      evaluate: async ({ input, output, metadata }: any) => {
        const runs: Array<{ features: BaseFeature[] }> = output?.runs ?? [];
        const allFeatures = runs.flatMap((run) => run.features);

        if (runs.length === 0 || allFeatures.length === 0) {
          return { score: 1, explanation: 'No features to evaluate' };
        }

        const featuresUniqueById = uniqBy(allFeatures, 'id');
        const uniqueById = featuresUniqueById.length;
        // Fingerprint uniqueness computed over the already-deduplicated-by-id set,
        // so unique_by_fingerprint <= unique_by_id always holds.
        // If unique_by_fingerprint < unique_by_id, some features with different ids
        // have identical (type, subtype, properties) — a strong structural duplication signal.
        const uniqueByFingerprint = uniqBy(featuresUniqueById, featureFingerprint).length;

        const compactUniqueFeatures = featuresUniqueById
          .map((feature) => ({
            id: feature.id,
            type: feature.type,
            subtype: feature.subtype,
            title: feature.title,
            properties: feature.properties,
            description: feature.description?.slice(0, 300),
          }))
          .sort((a, b) =>
            `${a.type}:${a.subtype ?? ''}:${a.id}`.localeCompare(
              `${b.type}:${b.subtype ?? ''}:${b.id}`
            )
          );

        const criteria = [
          `SEMANTIC UNIQUENESS CHECK:
You are given a list of features identified from a stream, already de-duplicated by \`id\` across all runs (one representative per unique id).
Your job is to determine whether all unique ids are truly semantically distinct from each other, or whether some are SEMANTIC DUPLICATES.

Definitions:
- A "semantic duplicate" means two features that refer to the exact same underlying real-world component or fact, even if their ids, titles, or descriptions differ slightly.
- Only compare features within the same category: type + subtype must match for two features to be considered duplicates.
- If it is ambiguous whether two features refer to the same thing, treat them as NOT duplicates.
- Features that belong to the same technology family but represent different components, layers, or roles are NOT duplicates. Do NOT cluster features together just because they share a common technology or domain prefix.
- Two features are duplicates only if an operator managing this stream would consider them interchangeable: knowing one tells you everything knowing the other would. If they describe different operational concerns (different failure modes, different config knobs, different responsible teams), they are distinct.

Burden of proof for each cluster:
- Before placing two features in the same cluster, you must be able to state in one sentence what single real-world thing all members refer to.
- A valid identity statement names a specific component or process, not a category or domain (e.g. "all relate to X technology" or "all involve Y protocol" are categories, not identities — split the cluster).
- If you cannot write the one-sentence identity, the features are NOT duplicates.

Method:
- Read the full list of unique features in the output.
- For each candidate cluster, apply the burden-of-proof test above before finalising it.
- Group confirmed duplicates into "semantic clusters" — each cluster = one unique underlying real-world feature.
- N = the number of entries in \`unique_features_by_id\` (provided in the output).
- K = the number of clusters YOU form during your analysis. K is always <= N.

Scoring:
- You MUST state N and K as explicit integers before computing the score.
- You MUST compute score = K / N as an explicit arithmetic step and return that value.
- score = K / N
  - 1.0 means every feature is semantically unique (no duplicates, ideal)
  - lower is worse; e.g. 0.5 means on average each concept appears under two different ids
- Example: N=24, K=22 → score = 22/24 = 0.917

In your explanation:
- State N and K as integers, then write "score = K / N = <value>".
- Report the implied duplicate rate (1 - K/N).
- For each duplicate cluster, include the one-sentence identity statement that justifies it.
- List up to 5 of the largest duplicate clusters as arrays of feature ids (include type+subtype).
- Briefly note what drives the duplication (id naming instability, meaning drift, overly generic ids, etc.).

Deterministic hints (always unique_by_fingerprint <= unique_by_id):
- unique_by_id (= N) = ${uniqueById}
- unique_by_fingerprint (among the same N features, based on type+subtype+properties) = ${uniqueByFingerprint}
  A gap here (unique_by_fingerprint < N) signals features with different ids but identical structure.
`,
        ];

        return evaluators.criteria(criteria).evaluate({
          input: {
            stream_name: input?.stream_name,
            runs: input?.runs ?? runs.length,
            metadata,
          },
          output: {
            unique_features_by_id: compactUniqueFeatures,
            totals: {
              runs: runs.length,
              total_features: allFeatures.length,
              unique_by_id: uniqueById,
              unique_by_fingerprint: uniqueByFingerprint,
            },
          },
          expected: {},
        });
      },
    };
  }

  /**
   * Checks that features sharing the same id across runs refer to the same concept.
   * Only ids with differing fingerprints across runs are sent to the LLM — trivially
   * identical occurrences are counted as consistent without an LLM call.
   * Score = (trivially_consistent + llm_consistent) / total_multi_occurrence_ids.
   */
  function idConsistencyLlmEvaluator(evaluators: any) {
    return {
      name: 'llm_id_consistency',
      kind: 'LLM' as const,
      evaluate: async ({ input, output, metadata }: any) => {
        const runs: Array<{ features: BaseFeature[] }> = output?.runs ?? [];
        const allFeatures = runs.flatMap((run) => run.features);

        if (runs.length <= 1 || allFeatures.length === 0) {
          return { score: 1, explanation: 'Not enough runs to evaluate id consistency' };
        }

        const featuresById = new Map<string, BaseFeature[]>();
        runs.forEach((run) => {
          run.features.forEach((feature) => {
            const list = featuresById.get(feature.id) ?? [];
            list.push(feature);
            featuresById.set(feature.id, list);
          });
        });

        // Only ids appearing more than once are candidates for consistency checks
        const multiOccurrenceEntries = [...featuresById.entries()].filter(
          ([, features]) => features.length > 1
        );

        if (multiOccurrenceEntries.length === 0) {
          return {
            score: 1,
            explanation: 'No id appears in more than one run; id consistency cannot be assessed',
          };
        }

        const totalMultiOccurrence = multiOccurrenceEntries.length;

        // Split into trivially consistent (same fingerprint every time) and ambiguous (different fingerprints)
        const triviallyConsistent = multiOccurrenceEntries.filter(
          ([, features]) => uniqBy(features, featureFingerprint).length === 1
        );
        const ambiguous = multiOccurrenceEntries.filter(
          ([, features]) => uniqBy(features, featureFingerprint).length > 1
        );

        if (ambiguous.length === 0) {
          return {
            score: 1,
            explanation: `All ${totalMultiOccurrence} multi-occurrence ids are trivially consistent (same fingerprint across runs)`,
          };
        }

        // Build a compact representation of the ambiguous groups for the LLM
        const idGroups = ambiguous.map(([id, features]) => ({
          id,
          variants: uniqBy(features, featureFingerprint).map((f) => ({
            type: f.type,
            subtype: f.subtype,
            title: f.title,
            properties: f.properties,
            description: f.description?.slice(0, 200),
          })),
        }));

        const criteria = [
          `ID CONSISTENCY CHECK:
You are given groups of features that share the same \`id\` but were produced with different content across multiple feature-identification runs on the SAME stream.
Ideally, features with the same id always represent the same underlying real-world concept — id collisions (the same id used for different concepts) are a bug.

For each group you receive the distinct content variants observed for that id.

Definitions:
- "Consistent": all variants in the group clearly refer to the same underlying concept, even if minor wording or property details differ.
- "Inconsistent" (collision): the same id is used for different concepts in different runs — this means a feature is being incorrectly overwritten.

Method:
- For each id group, decide: consistent or inconsistent.
- Let M = number of ambiguous id groups provided (those with differing content across runs).
- Let C = number of groups you judge as consistent.

Scoring (score applies only to the ambiguous groups):
- score = C / M
  - 1.0 means all differing-content ids are still referring to the same concept (minor drift, acceptable)
  - lower is worse; a score of 0.7 means 30% of the ambiguous ids are genuine collisions

In your explanation:
- Report M and C, and the collision rate among ambiguous ids (1 - C/M).
- For each inconsistent id group (up to 5), show:
  - the id
  - each variant's type, subtype, title, and a brief description of the concept it represents
  - a one-sentence summary of why the variants conflict (e.g. "variant A describes X while variant B describes Y")
- Note what seems to drive collisions (overly generic ids, type confusion, unstable naming, etc.).

Context:
- total_multi_occurrence_ids=${totalMultiOccurrence}
- trivially_consistent_ids=${triviallyConsistent.length} (same fingerprint every time, not shown here)
- ambiguous_ids_sent_to_llm=${ambiguous.length}
`,
        ];

        const llmResult = await evaluators.criteria(criteria).evaluate({
          input: {
            stream_name: input?.stream_name,
            runs: input?.runs ?? runs.length,
            metadata,
          },
          output: {
            id_groups: idGroups,
          },
          expected: {},
        });

        // Combine the LLM score (over ambiguous ids) with the trivially consistent ids
        // to produce a final score over all multi-occurrence ids.
        const llmConsistent = (llmResult.score ?? 1) * ambiguous.length;
        const finalScore = (triviallyConsistent.length + llmConsistent) / totalMultiOccurrence;

        return {
          ...llmResult,
          score: finalScore,
          metadata: {
            ...llmResult.metadata,
            total_multi_occurrence_ids: totalMultiOccurrence,
            trivially_consistent: triviallyConsistent.length,
            ambiguous: ambiguous.length,
          },
        };
      },
    };
  }

  const duplicationEvaluator = {
    name: 'features_duplication',
    kind: 'CODE' as const,
    evaluate: async ({
      output,
    }: {
      output: { runs?: Array<{ features: BaseFeature[] }> };
    }) => {
      const allFeatures = output.runs?.flatMap((run) => run.features) || [];

      if (allFeatures.length === 0) {
        return { score: 1, explanation: 'No features to evaluate' };
      }

      // Work on one representative per id. This makes the relationship
      // unique_by_fingerprint <= unique_by_id a hard invariant and keeps
      // missed_duplicates unambiguous: it simply equals unique_by_id - unique_by_fingerprint
      // (same content, different ids). Id collisions (same id, different content across runs)
      // are a separate concern handled by the llm_id_consistency evaluator.
      const uniqueById = uniqBy(allFeatures, 'id');
      const uniqueByFingerprint = uniqBy(uniqueById, featureFingerprint);

      const missedDuplicates = uniqueById.length - uniqueByFingerprint.length;

      const score =
        uniqueById.length > 0
          ? Math.max(0, 1 - missedDuplicates / uniqueById.length)
          : 1;

      return {
        score,
        metadata: {
          total_features: allFeatures.length,
          unique_by_id: uniqueById.length,
          unique_by_fingerprint: uniqueByFingerprint.length,
          missed_duplicates: missedDuplicates,
        },
      };
    },
  };

  FEATURES_DUPLICATION_DATASETS.forEach((dataset) => {
    evaluate.describe(dataset.name, { tag: tags.stateful.classic }, () => {
      evaluate.beforeAll(async ({ apiServices }) => {
        await apiServices.streams.enable();
      });

      evaluate.afterAll(async ({ apiServices, esClient }) => {
        await apiServices.streams.disable();
        await esClient.indices.deleteDataStream({
          name: 'logs*',
        });
      });

      evaluate(
        'Features duplication - sample logs',
        async ({ apiServices, config, esClient, inferenceClient, logger, phoenixClient, evaluators }) => {

          await indexLogs({ scenario: 'sample_logs', config });

          await new Promise((resolve) => setTimeout(resolve, 3000));

          await phoenixClient.runExperiment(
            {
              dataset: {
                name: `Features duplication - sample logs`,
                description: dataset.description,
                examples: [
                  {
                    input: {
                      stream_name: 'logs',
                      runs: 5,
                    },
                  },
                ],
              },
              task: async ({ input }: { input: { stream_name: string; runs: number } }) => {
                return runRepeatedFeatureIdentification({
                  esClient,
                  streamName: input.stream_name,
                  runs: input.runs,
                  inferenceClient,
                  logger,
                });
              },
            },
            [
              duplicationEvaluator,
              semanticUniquenessLlmEvaluator(evaluators),
              idConsistencyLlmEvaluator(evaluators),
            ]
          );
        });
    });
  });
});

