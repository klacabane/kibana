/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiEmptyPrompt } from '@elastic/eui';
import React from 'react';
import { i18n } from '@kbn/i18n';
import { Redirect } from 'react-router-dom';
import styled from '@emotion/styled';
import { FETCH_STATUS, useFetcher } from '../../../hooks/use_fetcher';
import { getRedirectToTransactionDetailPageUrl } from '../trace_link/get_redirect_to_transaction_detail_page_url';
import { useApmParams } from '../../../hooks/use_apm_params';
import { useTimeRange } from '../../../hooks/use_time_range';

const CentralizedContainer = styled.div`
  height: 100%;
  display: flex;
`;

export function TransactionLink() {
  const {
    path: { transactionId },
    query: { rangeFrom, rangeTo, waterfallItemId },
  } = useApmParams('/link-to/transaction/{transactionId}');

  const { start, end } = useTimeRange({
    rangeFrom: rangeFrom || new Date(0).toISOString(),
    rangeTo: rangeTo || new Date().toISOString(),
  });

  const { data = { transaction: null }, status } = useFetcher(
    (callApmApi) => {
      if (transactionId) {
        return callApmApi('GET /internal/apm/transactions/{transactionId}', {
          params: {
            path: {
              transactionId,
            },
            query: {
              start,
              end,
            },
          },
        });
      }
    },
    [transactionId, start, end]
  );
  if (transactionId && status === FETCH_STATUS.SUCCESS) {
    if (data.transaction) {
      return (
        <Redirect
          to={getRedirectToTransactionDetailPageUrl({
            transaction: data.transaction,
            rangeFrom,
            rangeTo,
            waterfallItemId,
          })}
        />
      );
    }

    return <CentralizedContainer />;
  }

  return (
    <CentralizedContainer>
      <EuiEmptyPrompt
        iconType="apmTrace"
        title={
          <h2>
            {i18n.translate('xpack.apm.transactionLink.h2.fetchingTransactionLabel', {
              defaultMessage: 'Fetching transaction...',
            })}
          </h2>
        }
      />
    </CentralizedContainer>
  );
}
