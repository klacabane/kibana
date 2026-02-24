/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RunContext, TaskRunCreatorFunction } from '@kbn/task-manager-plugin/server';
import { getDeleteTaskRunResult } from '@kbn/task-manager-plugin/server/task';
import type { Logger } from '@kbn/logging';
import { TaskStatus } from '@kbn/streams-schema';
import type { TaskContext } from '.';
import {
  createStreamsFeaturesIdentificationTask,
  FEATURES_IDENTIFICATION_TASK_TYPE,
} from './features_identification';
import { DefinitionNotFoundError } from '../../streams/errors/definition_not_found_error';

describe('createStreamsFeaturesIdentificationTask', () => {
  const createMockLogger = () =>
    ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      get: jest.fn().mockReturnThis(),
    } as unknown as Logger);

  const createMockTaskClient = (taskId: string) => ({
    get: jest.fn().mockResolvedValue({
      id: taskId,
      status: TaskStatus.InProgress,
      created_at: new Date().toISOString(),
      space: 'default',
      type: FEATURES_IDENTIFICATION_TASK_TYPE,
      task: { params: {} },
    }),
    complete: jest.fn(),
    fail: jest.fn().mockResolvedValue(undefined),
    markCanceled: jest.fn(),
  });

  const createMockTaskContext = (overrides: Partial<TaskContext> = {}): TaskContext => ({
    logger: createMockLogger(),
    telemetry: {
      trackFeaturesIdentified: jest.fn(),
      trackSystemsIdentified: jest.fn(),
    } as unknown as TaskContext['telemetry'],
    getScopedClients: jest.fn(),
    ...overrides,
  });

  const createMockRunContext = (streamName: string) => ({
    fakeRequest: {},
    taskInstance: {
      id: `streams_features_identification_${streamName}`,
      params: {
        connectorId: 'test-connector',
        start: Date.now() - 3600000,
        end: Date.now(),
        streamName,
        _task: {
          id: `streams_features_identification_${streamName}`,
          type: FEATURES_IDENTIFICATION_TASK_TYPE,
          status: TaskStatus.InProgress,
          created_at: new Date().toISOString(),
          space: 'default',
          task: {
            params: {
              connectorId: 'test-connector',
              start: Date.now() - 3600000,
              end: Date.now(),
              streamName,
            },
          },
        },
      },
    },
    abortController: new AbortController(),
  });

  describe('deleted stream handling', () => {
    it('handles DefinitionNotFoundError gracefully when stream is deleted', async () => {
      const logger = createMockLogger();
      const streamName = 'logs.deleted-stream';
      const taskId = `streams_features_identification_${streamName}`;

      const mockStreamsClient = {
        getStream: jest
          .fn()
          .mockRejectedValue(new DefinitionNotFoundError(`Cannot find stream ${streamName}`)),
      };

      const mockTaskClient = createMockTaskClient(taskId);

      const mockScopedClients = {
        taskClient: mockTaskClient,
        scopedClusterClient: { asCurrentUser: {} },
        featureClient: {},
        streamsClient: mockStreamsClient,
        inferenceClient: { bindTo: jest.fn(), getConnectorById: jest.fn() },
        soClient: {},
      };

      const taskContext = createMockTaskContext({
        logger,
        getScopedClients: jest.fn().mockResolvedValue(mockScopedClients),
      });

      const taskDefinitions = createStreamsFeaturesIdentificationTask(taskContext);
      const taskDef = taskDefinitions[FEATURES_IDENTIFICATION_TASK_TYPE];
      const createTaskRunner = taskDef.createTaskRunner as TaskRunCreatorFunction;
      const runner = createTaskRunner(createMockRunContext(streamName) as unknown as RunContext);
      const result = await runner.run();

      expect(result).toEqual(getDeleteTaskRunResult());
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`stream "${streamName}" was deleted`)
      );
      expect(logger.error).not.toHaveBeenCalled();
      expect(mockTaskClient.fail).not.toHaveBeenCalled();
    });

    it('still fails for other errors', async () => {
      const logger = createMockLogger();
      const streamName = 'logs.error-stream';
      const taskId = `streams_features_identification_${streamName}`;

      const mockStreamsClient = {
        getStream: jest.fn().mockRejectedValue(new Error('Some other error')),
      };

      const mockInferenceClient = {
        bindTo: jest.fn(),
        getConnectorById: jest.fn().mockResolvedValue({ name: 'test-connector' }),
      };

      const mockTaskClient = createMockTaskClient(taskId);

      const mockScopedClients = {
        taskClient: mockTaskClient,
        scopedClusterClient: { asCurrentUser: {} },
        featureClient: {},
        streamsClient: mockStreamsClient,
        inferenceClient: mockInferenceClient,
        soClient: {},
      };

      const taskContext = createMockTaskContext({
        logger,
        getScopedClients: jest.fn().mockResolvedValue(mockScopedClients),
      });

      const taskDefinitions = createStreamsFeaturesIdentificationTask(taskContext);
      const taskDef = taskDefinitions[FEATURES_IDENTIFICATION_TASK_TYPE];
      const createTaskRunner = taskDef.createTaskRunner as TaskRunCreatorFunction;
      const runner = createTaskRunner(createMockRunContext(streamName) as unknown as RunContext);
      const result = await runner.run();

      expect(result).toEqual(getDeleteTaskRunResult());
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Some other error'),
        expect.any(Object)
      );
      expect(mockTaskClient.fail).toHaveBeenCalled();
    });
  });
});
