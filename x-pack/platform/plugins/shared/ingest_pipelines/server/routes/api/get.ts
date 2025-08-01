/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';

import { fetchPipelineStructureTree } from './fetch_pipeline_structure_tree';
import { deserializePipelines } from '../../../common/lib';
import { API_BASE_PATH } from '../../../common/constants';
import { RouteDependencies } from '../../types';

const paramsSchema = schema.object({
  name: schema.string(),
});

export const registerGetRoutes = ({ router, lib: { handleEsError } }: RouteDependencies): void => {
  // Get all pipelines
  router.get(
    {
      path: API_BASE_PATH,
      security: {
        authz: {
          enabled: false,
          reason: 'Relies on es client for authorization',
        },
      },
      validate: false,
    },
    async (ctx, req, res) => {
      const { client: clusterClient } = (await ctx.core).elasticsearch;

      try {
        const pipelines = await clusterClient.asCurrentUser.ingest.getPipeline();

        return res.ok({ body: deserializePipelines(pipelines) });
      } catch (error) {
        const esErrorResponse = handleEsError({ error, response: res });
        if (esErrorResponse.status === 404) {
          // ES returns 404 when there are no pipelines
          // Instead, we return an empty array and 200 status back to the client
          return res.ok({ body: [] });
        }
        return esErrorResponse;
      }
    }
  );

  // Get single pipeline
  router.get(
    {
      path: `${API_BASE_PATH}/{name}`,
      security: {
        authz: {
          enabled: false,
          reason: 'Relies on es client for authorization',
        },
      },
      validate: {
        params: paramsSchema,
      },
    },
    async (ctx, req, res) => {
      const { client: clusterClient } = (await ctx.core).elasticsearch;
      const { name } = req.params;

      try {
        const pipelines = deserializePipelines(
          await clusterClient.asCurrentUser.ingest.getPipeline({
            id: name,
          })
        );
        return res.ok({
          body: {
            ...pipelines!.find((pipeline) => pipeline.name),
            name,
          },
        });
      } catch (error) {
        return handleEsError({ error, response: res });
      }
    }
  );

  // Get pipeline structure tree
  router.get(
    {
      path: `${API_BASE_PATH}/structure_tree/{name}`,
      security: {
        authz: {
          enabled: false,
          reason: 'Relies on es client for authorization',
        },
      },
      validate: {
        params: paramsSchema,
      },
    },
    async (ctx, req, res) => {
      const { client: clusterClient } = (await ctx.core).elasticsearch;
      const { name } = req.params;

      try {
        const allPipelines = await clusterClient.asCurrentUser.ingest.getPipeline();
        const pipelineStructureTree = fetchPipelineStructureTree(allPipelines, name);
        return res.ok({
          body: {
            pipelineStructureTree,
          },
        });
      } catch (error) {
        return handleEsError({ error, response: res });
      }
    }
  );
};
