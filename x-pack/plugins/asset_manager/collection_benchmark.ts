/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/* eslint-disable @kbn/imports/no_boundary_crossing, no-console */

process.title = 'implicit_collection_benchmark';

import apm from 'elastic-apm-node';
import { Client } from '@elastic/elasticsearch';
import { CollectorRunner } from './server/lib/implicit_collection/collector_runner';
import {
  Collector,
  CollectorOptions,
  collectServices,
  collectPods,
  collectHosts,
  collectContainers,
} from './server/lib/implicit_collection/collectors';

const COLLECTOR_RUN_COUNT = Number(process.argv[3]) || 1;
console.log(`Will run collector ${COLLECTOR_RUN_COUNT} times`);

const cloudClient = new Client({
  auth: { username: '', password: '' },
  nodes: [''],
});

(async () => {
  const client = new Client({
    auth: { username: 'elastic', password: 'changeme' },
    nodes: ['http://localhost:9200'],
  });

  apm.start({ serverUrl: 'https://assets-data.apm.europe-west3.gcp.cloud.es.io' });

  const collector = getCollector() as Collector;

  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log(`starting collector ${collector.name}`);
  await runCollector(client, collector);
})();

async function runCollector(client: Client, collector: Collector) {
  const runner = new CollectorRunner({
    inputClient: client,
    outputClient: client,
    intervalMs: 1,
    logger: console as any,
  });

  let metrics: { assets_count: number } = { assets_count: 0 };

  runner.registerCollector(collector.name, async (opts: CollectorOptions) => {
    const result = await collector(opts);
    metrics.assets_count = metrics.assets_count += result.assets.length;

    return result;
  });

  for (let i = 0; i < COLLECTOR_RUN_COUNT; i++) {
    await client.indices.clearCache();

    const startTime = Date.now();
    await runner.run();
    const stopTime = Date.now();

    await cloudClient
      .index({
        index: 'benchmark-assets_1',
        document: {
          ...metrics,
          collector: collector.name,
          total_time_ms: stopTime - startTime,
          '@timestamp': stopTime,
        },
      })
      .catch((err) => console.log('ERR', err));

    metrics = { assets_count: 0 };
  }
}

function getCollector() {
  const type = process.argv[2];
  const collectors = [collectHosts, collectContainers, collectPods, collectServices];

  const collector = collectors.find(
    ({ name }) => name.toLowerCase() === `collect${type}`.toLowerCase()
  );
  if (!collector) {
    console.log(`collector ${type} not found`);
    process.exit(1);
  }
  return collector as Collector;
}
