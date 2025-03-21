/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { coreMock } from '@kbn/core/public/mocks';
import type { CoreSetup } from '@kbn/core/server';
import { monitoringCollectionMock } from '@kbn/monitoring-collection-plugin/server/mocks';
import type { Metric } from '@kbn/monitoring-collection-plugin/server';
import { registerClusterCollector } from './register_cluster_collector';
import type { ActionsPluginsStart } from '../plugin';
import type { ClusterActionsMetric } from './types';

jest.useFakeTimers();
jest.setSystemTime(new Date('2020-03-09').getTime());

describe('registerClusterCollector()', () => {
  const monitoringCollection = monitoringCollectionMock.createSetup();
  const coreSetup = coreMock.createSetup() as unknown as CoreSetup<ActionsPluginsStart, unknown>;
  const taskManagerAggregate = jest.fn();

  beforeEach(() => {
    (coreSetup.getStartServices as jest.Mock).mockImplementation(async () => {
      return [
        undefined,
        {
          taskManager: {
            aggregate: taskManagerAggregate,
          },
        },
      ];
    });
  });

  it('should get overdue actions', async () => {
    const metrics: Record<string, Metric<unknown>> = {};
    monitoringCollection.registerMetric.mockImplementation((metric) => {
      metrics[metric.type] = metric;
    });
    registerClusterCollector({ monitoringCollection, core: coreSetup });

    const metricTypes = Object.keys(metrics);
    expect(metricTypes.length).toBe(1);
    expect(metricTypes[0]).toBe('cluster_actions');

    taskManagerAggregate.mockImplementation(async () => ({
      took: 1,
      timed_out: false,
      _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
      hits: { total: { value: 63, relation: 'eq' }, max_score: null, hits: [] },
      aggregations: { overdueByPercentiles: { values: { '50.0': 125369, '99.0': 229561.87 } } },
    }));

    const result = (await metrics.cluster_actions.fetch()) as ClusterActionsMetric;
    expect(result.overdue.count).toEqual(63);
    expect(result.overdue.delay.p50).toEqual(125369);
    expect(result.overdue.delay.p99).toEqual(229561.87);
    expect(taskManagerAggregate).toHaveBeenCalledWith({
      query: {
        bool: {
          must: [
            {
              term: {
                'task.scope': {
                  value: 'actions',
                },
              },
            },
            {
              bool: {
                should: [
                  {
                    bool: {
                      must: [
                        {
                          term: {
                            'task.status': 'idle',
                          },
                        },
                        {
                          range: {
                            'task.runAt': {
                              lte: 'now',
                            },
                          },
                        },
                      ],
                    },
                  },
                  {
                    bool: {
                      must: [
                        {
                          bool: {
                            should: [
                              {
                                term: {
                                  'task.status': 'running',
                                },
                              },
                              {
                                term: {
                                  'task.status': 'claiming',
                                },
                              },
                            ],
                          },
                        },
                        {
                          range: {
                            'task.retryAt': {
                              lte: 'now',
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      runtime_mappings: {
        overdueBy: {
          type: 'long',
          script: {
            source: `
            def runAt = doc['task.runAt'];
            if(!runAt.empty) {
              emit(new Date().getTime() - runAt.value.getMillis());
            } else {
              def retryAt = doc['task.retryAt'];
              if(!retryAt.empty) {
                emit(new Date().getTime() - retryAt.value.getMillis());
              } else {
                emit(0);
              }
            }
          `,
          },
        },
      },
      aggs: {
        overdueByPercentiles: {
          percentiles: {
            field: 'overdueBy',
            percents: [50, 99],
          },
        },
      },
    });
  });

  it('should handle null results', async () => {
    const metrics: Record<string, Metric<unknown>> = {};
    monitoringCollection.registerMetric.mockImplementation((metric) => {
      metrics[metric.type] = metric;
    });
    registerClusterCollector({ monitoringCollection, core: coreSetup });

    const metricTypes = Object.keys(metrics);
    expect(metricTypes.length).toBe(1);
    expect(metricTypes[0]).toBe('cluster_actions');

    taskManagerAggregate.mockImplementation(async () => ({
      took: 1,
      timed_out: false,
      _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
      hits: { total: { value: null, relation: 'eq' }, max_score: null, hits: [] },
      aggregations: {},
    }));

    const result = (await metrics.cluster_actions.fetch()) as ClusterActionsMetric;
    expect(result.overdue.count).toEqual(0);
    expect(result.overdue.delay.p50).toEqual(0);
    expect(result.overdue.delay.p99).toEqual(0);
  });

  it('should handle null percentile values', async () => {
    const metrics: Record<string, Metric<unknown>> = {};
    monitoringCollection.registerMetric.mockImplementation((metric) => {
      metrics[metric.type] = metric;
    });
    registerClusterCollector({ monitoringCollection, core: coreSetup });

    const metricTypes = Object.keys(metrics);
    expect(metricTypes.length).toBe(1);
    expect(metricTypes[0]).toBe('cluster_actions');

    taskManagerAggregate.mockImplementation(async () => ({
      took: 1,
      timed_out: false,
      _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
      hits: { total: { value: null, relation: 'eq' }, max_score: null, hits: [] },
      aggregations: { overdueByPercentiles: { values: { '50.0': null, '99.0': null } } },
    }));

    const result = (await metrics.cluster_actions.fetch()) as ClusterActionsMetric;
    expect(result.overdue.count).toEqual(0);
    expect(result.overdue.delay.p50).toEqual(0);
    expect(result.overdue.delay.p99).toEqual(0);
  });

  it('should gracefully handle search errors', async () => {
    const metrics: Record<string, Metric<unknown>> = {};
    monitoringCollection.registerMetric.mockImplementation((metric) => {
      metrics[metric.type] = metric;
    });
    registerClusterCollector({ monitoringCollection, core: coreSetup });

    const metricTypes = Object.keys(metrics);
    expect(metricTypes.length).toBe(1);
    expect(metricTypes[0]).toBe('cluster_actions');

    taskManagerAggregate.mockRejectedValue(new Error('Failure'));

    const result = (await metrics.cluster_actions.fetch()) as ClusterActionsMetric;
    expect(result.overdue.count).toEqual(0);
    expect(result.overdue.delay.p50).toEqual(0);
    expect(result.overdue.delay.p99).toEqual(0);
  });
});
