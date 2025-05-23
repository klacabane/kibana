/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { AggregateRulesResponseBody } from '@kbn/alerting-plugin/common/routes/rule/apis/aggregate';
import { INTERNAL_BASE_ALERTING_API_PATH } from '../../constants';
import { mapFiltersToKql } from './map_filters_to_kql';
import type { LoadRuleAggregationsProps, AggregateRulesResponse } from './aggregate_helpers';
import { rewriteBodyRes } from './aggregate_helpers';

export async function loadRuleAggregations({
  http,
  searchText,
  actionTypesFilter,
  ruleExecutionStatusesFilter,
  ruleStatusesFilter,
  tagsFilter,
  ruleTypeIds,
  consumers,
}: LoadRuleAggregationsProps): Promise<AggregateRulesResponse> {
  const filters = mapFiltersToKql({
    actionTypesFilter,
    ruleExecutionStatusesFilter,
    ruleStatusesFilter,
    tagsFilter,
  });
  const res = await http.post<AggregateRulesResponseBody>(
    `${INTERNAL_BASE_ALERTING_API_PATH}/rules/_aggregate`,
    {
      body: JSON.stringify({
        search_fields: searchText ? JSON.stringify(['name', 'tags']) : undefined,
        search: searchText,
        filter: filters.length ? filters.join(' and ') : undefined,
        default_search_operator: 'AND',
        rule_type_ids: ruleTypeIds,
        consumers,
      }),
    }
  );
  return rewriteBodyRes(res);
}
