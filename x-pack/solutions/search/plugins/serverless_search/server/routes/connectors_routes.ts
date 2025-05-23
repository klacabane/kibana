/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import {
  createConnector,
  deleteConnectorById,
  fetchConnectorById,
  fetchConnectors,
  fetchSyncJobs,
  generateConnectorName,
  IngestPipelineParams,
  startConnectorSync,
  updateConnectorConfiguration,
  updateConnectorIndexName,
  updateConnectorNameAndDescription,
  updateConnectorScheduling,
  updateConnectorServiceType,
} from '@kbn/search-connectors';
import { DEFAULT_INGESTION_PIPELINE } from '../../common';
import { RouteDependencies } from '../plugin';
import { errorHandler } from '../utils/error_handler';

export const registerConnectorsRoutes = ({ logger, http, router }: RouteDependencies) => {
  router.get(
    {
      path: '/internal/serverless_search/connectors',
      validate: {},
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const privileges = await client.asCurrentUser.security.hasPrivileges({
        cluster: ['manage_connector', 'monitor_connector'],
      });
      const canManageConnectors = privileges.cluster.manage_connector;
      const canReadConnectors = privileges.cluster.monitor_connector;

      const connectors = canReadConnectors ? await fetchConnectors(client.asCurrentUser) : [];

      return response.ok({
        body: {
          connectors,
          canManageConnectors,
          canReadConnectors,
        },
      });
    })
  );

  router.get(
    {
      path: '/internal/serverless_search/connector/{connectorId}',
      validate: {
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const connector = await fetchConnectorById(client.asCurrentUser, request.params.connectorId);

      return connector
        ? response.ok({
            body: {
              connector,
            },
            headers: { 'content-type': 'application/json' },
          })
        : response.notFound();
    })
  );

  router.post(
    {
      path: '/internal/serverless_search/connectors',
      validate: {},
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const defaultPipeline: IngestPipelineParams = {
        name: DEFAULT_INGESTION_PIPELINE,
        extract_binary_content: true,
        reduce_whitespace: true,
        run_ml_inference: true,
      };
      const connector = await createConnector(client.asCurrentUser, {
        indexName: null,
        isNative: false,
        language: null,
        pipeline: defaultPipeline,
      });

      return response.ok({
        body: {
          connector,
        },
        headers: { 'content-type': 'application/json' },
      });
    })
  );

  router.post(
    {
      path: '/internal/serverless_search/connectors/{connectorId}/name',
      validate: {
        body: schema.object({
          name: schema.string(),
        }),
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const result = await updateConnectorNameAndDescription(
        client.asCurrentUser,
        request.params.connectorId,
        {
          name: request.body.name,
        }
      );

      return response.ok({
        body: {
          result,
        },
        headers: { 'content-type': 'application/json' },
      });
    })
  );

  router.post(
    {
      path: '/internal/serverless_search/connectors/{connectorId}/description',
      validate: {
        body: schema.object({
          description: schema.string(),
        }),
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const result = await updateConnectorNameAndDescription(
        client.asCurrentUser,
        request.params.connectorId,
        {
          description: request.body.description,
        }
      );

      return response.ok({
        body: {
          result,
        },
        headers: { 'content-type': 'application/json' },
      });
    })
  );

  router.post(
    {
      path: '/internal/serverless_search/connectors/{connectorId}/index_name',
      validate: {
        body: schema.object({
          index_name: schema.string(),
        }),
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      try {
        const result = await updateConnectorIndexName(
          client.asCurrentUser,
          request.params.connectorId,
          request.body.index_name
        );
        return response.ok({
          body: {
            result,
          },
          headers: { 'content-type': 'application/json' },
        });
      } catch (e) {
        return response.conflict({ body: e });
      }
    })
  );

  router.post(
    {
      path: '/internal/serverless_search/connectors/{connectorId}/service_type',
      validate: {
        body: schema.object({
          service_type: schema.string(),
        }),
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const result = await updateConnectorServiceType(
        client.asCurrentUser,
        request.params.connectorId,
        request.body.service_type
      );

      return response.ok({
        body: {
          result,
        },
        headers: { 'content-type': 'application/json' },
      });
    })
  );

  router.delete(
    {
      path: '/internal/serverless_search/connectors/{connectorId}',
      validate: {
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const result = await deleteConnectorById(client.asCurrentUser, request.params.connectorId);
      return response.ok({
        body: {
          result,
        },
        headers: { 'content-type': 'application/json' },
      });
    })
  );

  router.post(
    {
      path: '/internal/serverless_search/connectors/{connectorId}/configuration',
      validate: {
        body: schema.object({
          configuration: schema.recordOf(
            schema.string(),
            schema.oneOf([schema.string(), schema.number(), schema.boolean()])
          ),
        }),
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const result = await updateConnectorConfiguration(
        client.asCurrentUser,
        request.params.connectorId,
        request.body.configuration
      );

      return response.ok({
        body: result,
        headers: { 'content-type': 'application/json' },
      });
    })
  );

  router.post(
    {
      path: '/internal/serverless_search/connectors/{connectorId}/sync',
      validate: {
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const result = await startConnectorSync(client.asCurrentUser, {
        connectorId: request.params.connectorId,
      });

      return response.ok({
        body: result,
        headers: { 'content-type': 'application/json' },
      });
    })
  );

  router.get(
    {
      path: '/internal/serverless_search/connectors/{connectorId}/sync_jobs',
      validate: {
        params: schema.object({
          connectorId: schema.string(),
        }),
        query: schema.object({
          from: schema.maybe(schema.number()),
          size: schema.maybe(schema.number()),
          type: schema.maybe(schema.string()),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const result = await fetchSyncJobs(
        client.asCurrentUser,
        request.params.connectorId,
        request.query.from || 0,
        request.query.size || 20,
        (request.query.type as 'content' | 'access_control' | 'all' | undefined) || 'all'
      );

      return response.ok({
        body: result,
        headers: { 'content-type': 'application/json' },
      });
    })
  );
  router.post(
    {
      path: '/internal/serverless_search/connectors/{connectorId}/scheduling',
      validate: {
        body: schema.object({
          access_control: schema.object({ enabled: schema.boolean(), interval: schema.string() }),
          full: schema.object({ enabled: schema.boolean(), interval: schema.string() }),
          incremental: schema.object({ enabled: schema.boolean(), interval: schema.string() }),
        }),
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      await updateConnectorScheduling(
        client.asCurrentUser,
        request.params.connectorId,
        request.body
      );
      return response.ok();
    })
  );

  router.post(
    {
      path: '/internal/serverless_search/connectors/{connectorId}/generate_name',
      validate: {
        body: schema.object({
          name: schema.string(),
          is_native: schema.boolean(),
          service_type: schema.string(),
        }),
        params: schema.object({
          connectorId: schema.string(),
        }),
      },
      security: {
        authz: {
          enabled: false,
          reason: 'This route delegates authorization to the es client',
        },
      },
    },
    errorHandler(logger)(async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const result = await generateConnectorName(
        client.asCurrentUser,
        request.body.service_type,
        request.body.is_native,
        request.body.name
      );

      return response.ok({
        body: {
          result,
        },
        headers: { 'content-type': 'application/json' },
      });
    })
  );
};
