/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';

import { casesSchema as casesSchemaV2 } from './v2';

export const casesSchema = casesSchemaV2.extends({
  incremental_id: schema.maybe(schema.nullable(schema.number())),
});
