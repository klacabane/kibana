/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClient } from '@kbn/core/server';
import { DEFAULT_DOCS_PER_PAGE } from '../types';

import { fetchSearchResults } from './fetch_search_results';

const DEFAULT_FROM_VALUE = 0;
describe('fetchSearchResults lib function', () => {
  const mockClient = {
    search: jest.fn(),
  };

  const indexName = 'search-regular-index';
  const query = 'banana';
  const mockSearchResponseWithHits = {
    _shards: { failed: 0, skipped: 0, successful: 2, total: 2 },
    hits: {
      hits: [
        {
          _id: '5a12292a0f5ae10021650d7e',
          _index: 'search-regular-index',
          _score: 4.437291,
          _source: { id: '5a12292a0f5ae10021650d7e', name: 'banana' },
        },
      ],

      max_score: null,
      total: { relation: 'eq', value: 1 },
    },
    timed_out: false,
    took: 4,
  };
  const regularSearchResultsResponse = {
    data: [
      {
        _index: 'search-regular-index',
        _id: '5a12292a0f5ae10021650d7e',
        _score: 4.437291,
        _source: {
          name: 'banana',
          id: '5a12292a0f5ae10021650d7e',
        },
      },
    ],
    _meta: {
      page: {
        from: 0,
        has_more_hits_than_total: false,
        size: 25,
        total: 1,
      },
    },
  };

  const emptySearchResultsResponse = {
    data: [],
    _meta: {
      page: {
        from: 0,
        has_more_hits_than_total: false,
        size: 25,
        total: 0,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return search results with hits', async () => {
    mockClient.search.mockImplementation(() => Promise.resolve(mockSearchResponseWithHits));

    await expect(
      fetchSearchResults(mockClient as unknown as ElasticsearchClient, indexName, query)
    ).resolves.toEqual(regularSearchResultsResponse);

    expect(mockClient.search).toHaveBeenCalledWith({
      from: DEFAULT_FROM_VALUE,
      index: indexName,
      q: query,
      size: DEFAULT_DOCS_PER_PAGE,
      track_total_hits: undefined,
    });
  });

  it('should escape quotes in queries and return results with hits', async () => {
    mockClient.search.mockImplementation(() => Promise.resolve(mockSearchResponseWithHits));

    await expect(
      fetchSearchResults(
        mockClient as unknown as ElasticsearchClient,
        indexName,
        '"yellow banana"',
        0,
        DEFAULT_DOCS_PER_PAGE
      )
    ).resolves.toEqual(regularSearchResultsResponse);

    expect(mockClient.search).toHaveBeenCalledWith({
      from: DEFAULT_FROM_VALUE,
      index: indexName,
      q: '\\"yellow banana\\"',
      size: DEFAULT_DOCS_PER_PAGE,
      track_total_hits: undefined,
    });
  });

  it('should return search results with hits when no query is passed', async () => {
    mockClient.search.mockImplementation(() => Promise.resolve(mockSearchResponseWithHits));

    await expect(
      fetchSearchResults(mockClient as unknown as ElasticsearchClient, indexName)
    ).resolves.toEqual(regularSearchResultsResponse);

    expect(mockClient.search).toHaveBeenCalledWith({
      from: DEFAULT_FROM_VALUE,
      index: indexName,
      size: DEFAULT_DOCS_PER_PAGE,
      track_total_hits: undefined,
    });
  });

  it('should return empty search results', async () => {
    mockClient.search.mockImplementationOnce(() =>
      Promise.resolve({
        ...mockSearchResponseWithHits,
        hits: {
          ...mockSearchResponseWithHits.hits,
          total: {
            ...mockSearchResponseWithHits.hits.total,
            value: 0,
          },
          hits: [],
        },
      })
    );

    await expect(
      fetchSearchResults(mockClient as unknown as ElasticsearchClient, indexName, query)
    ).resolves.toEqual(emptySearchResultsResponse);

    expect(mockClient.search).toHaveBeenCalledWith({
      from: DEFAULT_FROM_VALUE,
      index: indexName,
      q: query,
      size: DEFAULT_DOCS_PER_PAGE,
      track_total_hits: undefined,
    });
  });

  it('should send track_total_hits true when specified', async () => {
    mockClient.search.mockImplementationOnce(() =>
      Promise.resolve({
        ...mockSearchResponseWithHits,
        hits: {
          ...mockSearchResponseWithHits.hits,
          total: {
            ...mockSearchResponseWithHits.hits.total,
            value: 0,
          },
          hits: [],
        },
      })
    );

    await expect(
      fetchSearchResults(
        mockClient as unknown as ElasticsearchClient,
        indexName,
        query,
        0,
        25,
        true
      )
    ).resolves.toEqual(emptySearchResultsResponse);

    expect(mockClient.search).toHaveBeenCalledWith({
      from: DEFAULT_FROM_VALUE,
      index: indexName,
      q: query,
      size: DEFAULT_DOCS_PER_PAGE,
      track_total_hits: true,
    });
  });
});
