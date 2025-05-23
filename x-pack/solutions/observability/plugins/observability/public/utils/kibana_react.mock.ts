/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { casesPluginMock } from '@kbn/cases-plugin/public/mocks';
import { coreMock, notificationServiceMock, overlayServiceMock } from '@kbn/core/public/mocks';
import { observabilityPublicPluginsStartMock } from '../plugin.mock';

export const kibanaStartMock = {
  startContract() {
    return {
      notifications: notificationServiceMock.createStartContract(),
      overlays: overlayServiceMock.createStartContract(),
      services: {
        ...coreMock.createStart(),
        ...observabilityPublicPluginsStartMock.createStart(),
        storage: coreMock.createStorage(),
        cases: { ...casesPluginMock.createStartContract() },
        docLinks: {
          links: {
            query: {},
            observability: {
              slo: 'dummy_link',
            },
          },
        },
      },
    };
  },
};
