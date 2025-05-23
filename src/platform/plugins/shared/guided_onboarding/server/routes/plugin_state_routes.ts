/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { IRouter, SavedObjectsClient } from '@kbn/core/server';
import { schema } from '@kbn/config-schema';
import { GuideState } from '@kbn/guided-onboarding';
import { guideStateSavedObjectsType, pluginStateSavedObjectsType } from '../saved_objects';
import { getPluginState, updatePluginStatus } from '../helpers/plugin_state_utils';
import { API_BASE_PATH } from '../../common';
import { updateGuideState } from '../helpers';

export const registerGetPluginStateRoute = (router: IRouter) => {
  router.get(
    {
      path: `${API_BASE_PATH}/state`,
      security: {
        authz: {
          enabled: false,
          reason:
            "This route is opted out from authorization because it's a wrapper around the Saved Object client",
        },
      },
      validate: false,
    },
    async (context, request, response) => {
      const coreContext = await context.core;
      const savedObjectsClient = coreContext.savedObjects.getClient({
        includedHiddenTypes: [pluginStateSavedObjectsType, guideStateSavedObjectsType],
      }) as SavedObjectsClient;
      const pluginState = await getPluginState(savedObjectsClient);
      return response.ok({
        body: {
          pluginState,
        },
      });
    }
  );
};

export const registerPutPluginStateRoute = (router: IRouter) => {
  router.put(
    {
      path: `${API_BASE_PATH}/state`,
      security: {
        authz: {
          enabled: false,
          reason:
            "This route is opted out from authorization because it's a wrapper around the Saved Object client",
        },
      },
      validate: {
        body: schema.object({
          status: schema.maybe(schema.string()),
          guide: schema.maybe(
            schema.object({
              status: schema.string(),
              guideId: schema.string(),
              isActive: schema.boolean(),
              steps: schema.arrayOf(
                schema.object({
                  status: schema.string(),
                  id: schema.string(),
                })
              ),
              // params are dynamic values
              params: schema.maybe(schema.object({}, { unknowns: 'allow' })),
            })
          ),
        }),
      },
    },
    async (context, request, response) => {
      const { status, guide } = request.body as { status?: string; guide?: GuideState };

      const coreContext = await context.core;
      const savedObjectsClient = coreContext.savedObjects.getClient({
        includedHiddenTypes: [pluginStateSavedObjectsType, guideStateSavedObjectsType],
      }) as SavedObjectsClient;

      if (status) {
        await updatePluginStatus(savedObjectsClient, status);
      }
      if (guide) {
        await updateGuideState(savedObjectsClient, guide);
      }

      const pluginState = await getPluginState(savedObjectsClient);
      return response.ok({
        body: {
          pluginState,
        },
      });
    }
  );
};
