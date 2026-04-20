/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createPrompt } from '@kbn/inference-common';
import { z } from '@kbn/zod/v4';
import systemPromptText from './system_prompt.text';
import userPromptText from './user_prompt.text';

const MERGE_CORRECTNESS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          correct: {
            type: 'boolean',
            description:
              'true if the merge is justified (both features represent the same concept), false otherwise',
          },
          reason: {
            type: 'string',
            description: 'One-sentence explanation of why the merge is correct or incorrect',
          },
        },
        required: ['correct', 'reason'],
      },
      description:
        'One verdict per merge event, in the same order as the input array. Must contain exactly as many entries as there are merge events.',
    },
    explanation: {
      type: 'string',
      description:
        'Overall summary of merge quality: common patterns, notable incorrect merges, and any systemic issues observed',
    },
  },
  required: ['results', 'explanation'],
} as const;

export const MergeCorrectnessPrompt = createPrompt({
  name: 'merge_correctness_analysis',
  description: 'Evaluate whether feature merges based on shared id are semantically correct',
  input: z.object({
    stream_name: z.string(),
    merge_events: z.string(),
  }),
})
  .version({
    system: {
      mustache: {
        template: systemPromptText,
      },
    },
    template: {
      mustache: {
        template: userPromptText,
      },
    },
    toolChoice: {
      function: 'evaluate_merges',
    },
    tools: {
      evaluate_merges: {
        description: 'Return merge correctness analysis',
        schema: MERGE_CORRECTNESS_OUTPUT_SCHEMA,
      },
    },
  } as const)
  .get();
