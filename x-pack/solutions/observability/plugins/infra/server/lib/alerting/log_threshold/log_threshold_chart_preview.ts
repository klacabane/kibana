/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import type { ResolvedLogView } from '@kbn/logs-shared-plugin/common';
import { decodeOrThrow } from '@kbn/io-ts-utils';
import type { estypes } from '@elastic/elasticsearch';
import type {
  ExecutionTimeRange,
  GroupedSearchQueryResponse,
  UngroupedSearchQueryResponse,
} from '../../../../common/alerting/logs/log_threshold/types';
import {
  GroupedSearchQueryResponseRT,
  isOptimizedGroupedSearchQueryResponse,
  UngroupedSearchQueryResponseRT,
} from '../../../../common/alerting/logs/log_threshold/types';
import type {
  GetLogAlertsChartPreviewDataAlertParamsSubset,
  Point,
  Series,
} from '../../../../common/http_api';
import type { InfraPluginRequestHandlerContext } from '../../../types';
import type { KibanaFramework } from '../../adapters/framework/kibana_framework_adapter';
import { buildFiltersFromCriteria } from '../../../../common/alerting/logs/log_threshold/query_helpers';
import { getGroupedESQuery, getUngroupedESQuery } from './log_threshold_executor';

const COMPOSITE_GROUP_SIZE = 40;

export async function getChartPreviewData(
  requestContext: InfraPluginRequestHandlerContext,
  resolvedLogView: ResolvedLogView,
  callWithRequest: KibanaFramework['callWithRequest'],
  alertParams: GetLogAlertsChartPreviewDataAlertParamsSubset,
  buckets: number,
  executionTimeRange?: ExecutionTimeRange
) {
  const { indices, timestampField, runtimeMappings } = resolvedLogView;
  const { groupBy, timeSize, timeUnit } = alertParams;
  const isGrouped = groupBy && groupBy.length > 0 ? true : false;

  // Charts will use an expanded time range
  const expandedAlertParams = {
    ...alertParams,
    timeSize: timeSize * buckets,
  };

  const { rangeFilter } = buildFiltersFromCriteria(
    expandedAlertParams,
    timestampField,
    executionTimeRange
  );

  const query = isGrouped
    ? getGroupedESQuery(
        expandedAlertParams,
        timestampField,
        indices,
        runtimeMappings,
        executionTimeRange
      )
    : getUngroupedESQuery(
        expandedAlertParams,
        timestampField,
        indices,
        runtimeMappings,
        executionTimeRange
      );

  if (!query) {
    throw new Error('ES query could not be built from the provided alert params');
  }

  const expandedQuery = addHistogramAggregationToQuery(
    query,
    rangeFilter,
    `${timeSize}${timeUnit}`,
    timestampField,
    isGrouped
  );

  const series = isGrouped
    ? processGroupedResults(await getGroupedResults(expandedQuery, requestContext, callWithRequest))
    : processUngroupedResults(
        await getUngroupedResults(expandedQuery, requestContext, callWithRequest)
      );

  return { series };
}

// Expand the same query that powers the executor with a date histogram aggregation
export const addHistogramAggregationToQuery = (
  query: estypes.SearchRequest,
  rangeFilter: any,
  interval: string,
  timestampField: string,
  isGrouped: boolean
) => {
  const histogramAggregation = {
    histogramBuckets: {
      date_histogram: {
        field: timestampField,
        fixed_interval: interval,
        // Utilise extended bounds to make sure we get a full set of buckets even if there are empty buckets
        // at the start and / or end of the range.
        extended_bounds: {
          min: rangeFilter.range[timestampField].gte,
          max: rangeFilter.range[timestampField].lte,
        },
      },
    },
  };

  if (!isGrouped) {
    query = {
      ...query,
      aggregations: histogramAggregation,
    };
    return query;
  }

  const aggs = query.aggregations;
  const groups = aggs?.groups;
  const groupsAggs = groups?.aggregations;

  if (!aggs || !groups || !groupsAggs) {
    return query;
  }

  const isOptimizedQuery = !groupsAggs.filtered_results;

  if (isOptimizedQuery) {
    query.aggregations = {
      ...aggs,
      groups: {
        ...groups,
        aggregations: {
          ...groupsAggs,
          ...histogramAggregation,
        },
      },
    };
  } else {
    query.aggregations = {
      ...aggs,
      groups: {
        ...groups,
        aggregations: {
          ...groupsAggs,
          filtered_results: {
            ...groupsAggs.filtered_results,
            aggregations: histogramAggregation,
          },
        },
      },
    };
  }

  return query;
};

const getUngroupedResults = async (
  query: object,
  requestContext: InfraPluginRequestHandlerContext,
  callWithRequest: KibanaFramework['callWithRequest']
) => {
  return decodeOrThrow(UngroupedSearchQueryResponseRT)(
    await callWithRequest(requestContext, 'search', query)
  );
};

const getGroupedResults = async (
  query: object,
  requestContext: InfraPluginRequestHandlerContext,
  callWithRequest: KibanaFramework['callWithRequest']
) => {
  let compositeGroupBuckets: GroupedSearchQueryResponse['aggregations']['groups']['buckets'] = [];
  let lastAfterKey: GroupedSearchQueryResponse['aggregations']['groups']['after_key'] | undefined;

  while (true) {
    const queryWithAfterKey: any = { ...query };
    queryWithAfterKey.aggregations.groups.composite.after = lastAfterKey;
    const groupResponse: GroupedSearchQueryResponse = decodeOrThrow(GroupedSearchQueryResponseRT)(
      await callWithRequest(requestContext, 'search', queryWithAfterKey)
    );
    compositeGroupBuckets = [
      ...compositeGroupBuckets,
      ...groupResponse.aggregations.groups.buckets,
    ];
    lastAfterKey = groupResponse.aggregations.groups.after_key;
    if (groupResponse.aggregations.groups.buckets.length < COMPOSITE_GROUP_SIZE) {
      break;
    }
  }

  return compositeGroupBuckets;
};

const processGroupedResults = (
  results: GroupedSearchQueryResponse['aggregations']['groups']['buckets']
): Series => {
  const getGroupName = (
    key: GroupedSearchQueryResponse['aggregations']['groups']['buckets'][0]['key']
  ) => Object.values(key).join(', ');

  if (isOptimizedGroupedSearchQueryResponse(results)) {
    return results.reduce<Series>((series, group) => {
      if (!group.histogramBuckets) return series;
      const groupName = getGroupName(group.key);
      const points = group.histogramBuckets.buckets.reduce<Point[]>((pointsAcc, bucket) => {
        const { key, doc_count: count } = bucket;
        return [...pointsAcc, { timestamp: key, value: count }];
      }, []);
      return [...series, { id: groupName, points }];
    }, []);
  } else {
    return results.reduce<Series>((series, group) => {
      if (!group.filtered_results.histogramBuckets) return series;
      const groupName = getGroupName(group.key);
      const points = group.filtered_results.histogramBuckets.buckets.reduce<Point[]>(
        (pointsAcc, bucket) => {
          const { key, doc_count: count } = bucket;
          return [...pointsAcc, { timestamp: key, value: count }];
        },
        []
      );
      return [...series, { id: groupName, points }];
    }, []);
  }
};

const processUngroupedResults = (results: UngroupedSearchQueryResponse): Series => {
  if (!results.aggregations?.histogramBuckets) return [];
  const points = results.aggregations.histogramBuckets.buckets.reduce<Point[]>(
    (pointsAcc, bucket) => {
      const { key, doc_count: count } = bucket;
      return [...pointsAcc, { timestamp: key, value: count }];
    },
    []
  );
  return [{ id: everythingSeriesName, points }];
};

const everythingSeriesName = i18n.translate(
  'xpack.infra.logs.alerting.threshold.everythingSeriesName',
  {
    defaultMessage: 'Log entries',
  }
);
