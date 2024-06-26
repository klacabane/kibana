/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KibanaRequest, SavedObjectsClientContract } from '@kbn/core/server';
import type { GetGuards } from '../shared_services';
import type { MlAlertingService } from '../../lib/alerts/alerting_service';
import { alertingServiceProvider } from '../../lib/alerts/alerting_service';
import { datafeedsProvider } from '../../models/job_service/datafeeds';

export function getAlertingServiceProvider(getGuards: GetGuards) {
  return {
    alertingServiceProvider(
      savedObjectsClient: SavedObjectsClientContract,
      request: KibanaRequest
    ) {
      const guards = getGuards(request, savedObjectsClient);
      return {
        preview: async (...args: Parameters<MlAlertingService['preview']>) => {
          return await guards
            .isFullLicense()
            .hasMlCapabilities(['canGetJobs'])
            .ok(({ mlClient, scopedClient, getFieldsFormatRegistry, getDataViewsService }) =>
              alertingServiceProvider(
                mlClient,
                datafeedsProvider(scopedClient, mlClient),
                getFieldsFormatRegistry,
                getDataViewsService
              ).preview(...args)
            );
        },
        execute: async (
          ...args: Parameters<MlAlertingService['execute']>
        ): ReturnType<MlAlertingService['execute']> => {
          return await guards
            .isFullLicense()
            .hasMlCapabilities(['canGetJobs'])
            .ok(({ mlClient, scopedClient, getFieldsFormatRegistry, getDataViewsService }) =>
              alertingServiceProvider(
                mlClient,
                datafeedsProvider(scopedClient, mlClient),
                getFieldsFormatRegistry,
                getDataViewsService
              ).execute(...args)
            );
        },
      };
    },
  };
}

export type MlAlertingServiceProvider = ReturnType<typeof getAlertingServiceProvider>;
