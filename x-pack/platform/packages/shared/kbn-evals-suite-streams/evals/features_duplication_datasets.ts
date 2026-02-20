/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export interface FeaturesDuplicationEvaluationExample {
  input: {
    /**
     * LogHub system name to ingest via synthtrace (e.g. "Apache", "OpenSSH").
     * This value is passed to synthtrace `sample_logs --scenarioOpts.systems="..."`.
     */
    system: string;
    /**
     * Child stream to fork from `logs` and route synthtrace docs into.
     * Routing is based on synthtrace's `attributes.filepath === "${system}.log"`.
     */
    stream_name: string;
    /**
     * How many documents to sample from Elasticsearch for identification.
     */
    sample_document_count: number;
    /**
     * Number of times to run feature identification on the same documents.
     */
    runs: number;
  };
  output: Record<string, never>;
  metadata: {
    description?: string;
  };
}

export interface FeaturesDuplicationEvaluationDataset {
  name: string;
  description: string;
  examples: FeaturesDuplicationEvaluationExample[];
}

export const FEATURES_DUPLICATION_DATASETS: FeaturesDuplicationEvaluationDataset[] = [
  {
    name: 'Features duplication (synthtrace sample_logs)',
    description:
      'Indexes one synthtrace LogHub system into a dedicated stream, then runs features identification multiple times to measure duplicated features across runs.',
    examples: [
      {
        input: {
          system: 'Apache',
          stream_name: 'logs.apache',
          sample_document_count: 200,
          runs: 5,
        },
        output: {},
        metadata: {
          description: 'Apache sample logs ingested via synthtrace',
        },
      },
    ],
  },
];
