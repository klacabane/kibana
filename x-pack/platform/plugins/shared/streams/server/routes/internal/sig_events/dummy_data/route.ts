/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { v4 as uuidv4 } from 'uuid';
import { STREAMS_API_PRIVILEGES } from '../../../../../common/constants';
import { createServerRoute } from '../../../create_server_route';

export interface DummySignificantEventsResponse {
  discovery: { discovery_id: string; discovery_slug: string };
  detection: { rule_uuid: string };
  verdict: { verdict_id: string };
  event: { event_id: string };
}

export const insertDummySignificantEventsRoute = createServerRoute({
  endpoint: 'POST /internal/streams/_dummy_significant_events',
  options: {
    access: 'internal',
    summary: 'Insert one document into each significant events data stream (dev/QA only).',
    description:
      'Writes a linked detection, discovery, verdict, and event into the four .significant_events-* data streams using the calling user and current space. Intended for manual verification of space-awareness and bulk write paths.',
  },
  security: {
    authz: {
      requiredPrivileges: [STREAMS_API_PRIVILEGES.manage],
    },
  },
  params: z.object({}),
  handler: async ({ request, getScopedClients }): Promise<DummySignificantEventsResponse> => {
    const { getDetectionClient, getDiscoveryClient, getEventClient, getVerdictClient } =
      await getScopedClients({ request });

    const now = new Date().toISOString();
    const discoveryId = uuidv4();
    const discoverySlug = `dummy-${discoveryId.slice(0, 8)}`;
    const ruleUuid = uuidv4();
    const verdictId = uuidv4();
    const eventId = uuidv4();

    const [detectionClient, discoveryClient, verdictClient, eventClient] = await Promise.all([
      getDetectionClient(),
      getDiscoveryClient(),
      getVerdictClient(),
      getEventClient(),
    ]);

    await Promise.all([
      detectionClient.bulkCreate([
        {
          '@timestamp': now,
          rule_uuid: ruleUuid,
          rule_name: `dummy-rule-${ruleUuid.slice(0, 8)}`,
          stream: `dummy-stream-${ruleUuid.slice(0, 8)}`,
        },
      ]),
      discoveryClient.bulkCreate([
        {
          '@timestamp': now,
          discovery_id: discoveryId,
          discovery_slug: discoverySlug,
          status: 'open',
          title: `Dummy discovery ${discoverySlug}`,
        },
      ]),
      verdictClient.bulkCreate([
        {
          '@timestamp': now,
          verdict: 'investigating',
          verdict_id: verdictId,
          discovery_id: discoveryId,
          discovery_slug: discoverySlug,
          title: `Dummy verdict ${verdictId.slice(0, 8)}`,
        },
      ]),
      eventClient.bulkCreate([
        {
          '@timestamp': now,
          event_id: eventId,
          verdict: 'investigating',
          verdict_id: verdictId,
          discovery_id: discoveryId,
          discovery_slug: discoverySlug,
          title: `Dummy event ${eventId.slice(0, 8)}`,
        },
      ]),
    ]);

    return {
      discovery: { discovery_id: discoveryId, discovery_slug: discoverySlug },
      detection: { rule_uuid: ruleUuid },
      verdict: { verdict_id: verdictId },
      event: { event_id: eventId },
    };
  },
});

export const dummySignificantEventsRoutes = {
  ...insertDummySignificantEventsRoute,
};
