/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// eslint-disable-next-line @kbn/imports/no_boundary_crossing
import { createUsageCollectionSetupMock } from '@kbn/usage-collection-plugin/server/mocks';
import type { UsageCollectorOptions } from '@kbn/usage-collection-plugin/server';

const collectorSet = createUsageCollectionSetupMock();

interface Usage {
  locale: string;
}

function createCollector(): UsageCollectorOptions<Usage> {
  return {
    type: 'from_fn_collector',
    isReady: () => true,
    fetch(): Usage {
      return {
        locale: 'en',
      };
    },
    schema: {
      locale: {
        type: 'keyword',
      },
    },
  };
}

export function defineCollectorFromVariable() {
  const fromVarCollector: UsageCollectorOptions<Usage> = {
    type: 'from_variable_collector',
    isReady: () => true,
    fetch(): Usage {
      return {
        locale: 'en',
      };
    },
    schema: {
      locale: {
        type: 'keyword',
      },
    },
  };

  collectorSet.makeUsageCollector<Usage>(fromVarCollector);
}

export function defineCollectorFromFn() {
  const fromFnCollector = createCollector();

  collectorSet.makeUsageCollector<Usage>(fromFnCollector);
}
