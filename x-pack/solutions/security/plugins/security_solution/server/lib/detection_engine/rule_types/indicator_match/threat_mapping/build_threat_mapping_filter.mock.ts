/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { estypes } from '@elastic/elasticsearch';
import type { ThreatMapping } from '@kbn/securitysolution-io-ts-alerting-types';

import type { Filter } from '@kbn/es-query';

import type { ThreatListDoc, ThreatListItem } from './types';

export const getThreatMappingMock = (): ThreatMapping => {
  return [
    {
      entries: [
        {
          field: 'host.name',
          type: 'mapping',
          value: 'host.name',
        },
        {
          field: 'host.ip',
          type: 'mapping',
          value: 'host.ip',
        },
      ],
    },
    {
      entries: [
        {
          field: 'destination.ip',
          type: 'mapping',
          value: 'destination.ip',
        },
        {
          field: 'destination.port',
          type: 'mapping',
          value: 'destination.port',
        },
      ],
    },
    {
      entries: [
        {
          field: 'source.port',
          type: 'mapping',
          value: 'source.port',
        },
      ],
    },
    {
      entries: [
        {
          field: 'source.ip',
          type: 'mapping',
          value: 'source.ip',
        },
      ],
    },
  ];
};

export const getThreatListSearchResponseMock = (): estypes.SearchResponse<ThreatListDoc> => ({
  took: 0,
  timed_out: false,
  _shards: {
    total: 1,
    successful: 1,
    failed: 0,
    skipped: 0,
  },
  hits: {
    total: 1,
    max_score: 0,
    hits: [getThreatListItemMock()],
  },
});

export const getThreatListItemMock = (overrides: Partial<ThreatListItem> = {}): ThreatListItem => ({
  _id: '123',
  _index: 'threat_index',
  _score: 0,
  _source: {
    '@timestamp': '2020-09-09T21:59:13Z',
    host: {
      name: 'host-1',
      ip: '192.168.0.0.1',
    },
    source: {
      ip: '127.0.0.1',
      port: 1,
    },
    destination: {
      ip: '127.0.0.1',
      port: 1,
    },
  },
  fields: getThreatListItemFieldsMock(),
  ...overrides,
});

export const getThreatListItemFieldsMock = () => ({
  '@timestamp': ['2020-09-09T21:59:13Z'],
  'host.name': ['host-1'],
  'host.ip': ['192.168.0.0.1'],
  'source.ip': ['127.0.0.1'],
  'source.port': [1],
  'destination.ip': ['127.0.0.1'],
  'destination.port': [1],
});

export const getFilterThreatMapping = (): ThreatMapping => [
  {
    entries: [
      {
        field: 'host.name',
        type: 'mapping',
        value: 'host.name',
      },
      {
        field: 'host.ip',
        type: 'mapping',
        value: 'host.ip',
      },
    ],
  },
  {
    entries: [
      {
        field: 'destination.ip',
        type: 'mapping',
        value: 'destination.ip',
      },
      {
        field: 'destination.port',
        type: 'mapping',
        value: 'destination.port',
      },
    ],
  },
  {
    entries: [
      {
        field: 'source.port',
        type: 'mapping',
        value: 'source.port',
      },
    ],
  },
  {
    entries: [
      {
        field: 'source.ip',
        type: 'mapping',
        value: 'source.ip',
      },
    ],
  },
];

export const getThreatMappingFilterMock = (): Filter => ({
  meta: {
    alias: null,
    negate: false,
    disabled: false,
  },
  query: getThreatMappingFiltersShouldMock()[0],
});

export const getThreatMappingFiltersShouldMock = (count = 1) => {
  return new Array(count).fill(null).map((_, index) => getThreatMappingFilterShouldMock(index + 1));
};

export const getThreatMappingFilterShouldMock = (port = 1) => ({
  bool: {
    should: [
      {
        bool: {
          filter: [
            { match: { 'host.name': { query: 'host-1', _name: expect.any(String) } } },
            { match: { 'host.ip': { query: '192.168.0.0.1', _name: expect.any(String) } } },
          ],
        },
      },
      {
        bool: {
          filter: [
            {
              match: { 'destination.ip': { query: '127.0.0.1', _name: expect.any(String) } },
            },
            { match: { 'destination.port': { query: port, _name: expect.any(String) } } },
          ],
        },
      },
      {
        bool: {
          filter: [{ match: { 'source.port': { query: port, _name: expect.any(String) } } }],
        },
      },
      {
        bool: {
          filter: [{ match: { 'source.ip': { query: '127.0.0.1', _name: expect.any(String) } } }],
        },
      },
    ],
    minimum_should_match: 1,
  },
});
