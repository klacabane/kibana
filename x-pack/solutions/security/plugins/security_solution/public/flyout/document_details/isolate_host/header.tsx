/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem, EuiSpacer, EuiTitle } from '@elastic/eui';
import type { FC } from 'react';
import React from 'react';
import type { TimelineEventsDetailsItem } from '@kbn/timelines-plugin/common';
import { AgentTypeIntegration } from '../../../common/components/endpoint/agents/agent_type_integration';
import { useAlertResponseActionsSupport } from '../../../common/hooks/endpoint/use_alert_response_actions_support';
import { useIsolateHostPanelContext } from './context';
import { FLYOUT_HEADER_TITLE_TEST_ID } from './test_ids';
import { FlyoutHeader } from '../../shared/components/flyout_header';
import { ISOLATE_HOST, UNISOLATE_HOST } from '../../../common/components/endpoint';

/**
 * Document details expandable right section header for the isolate host panel
 */
export const PanelHeader: FC = () => {
  const { isolateAction, dataFormattedForFieldBrowser: data } = useIsolateHostPanelContext();
  return <IsolateHostPanelHeader isolateAction={isolateAction} data={data} />;
};

export const IsolateHostPanelHeader: FC<{
  isolateAction: string;
  data: TimelineEventsDetailsItem[];
}> = ({ isolateAction, data }) => {
  const {
    details: { agentType },
  } = useAlertResponseActionsSupport(data);

  const title = (
    <EuiFlexGroup responsive gutterSize="s">
      <EuiFlexItem grow={false} data-test-subj="flyoutHostIsolationHeaderTitle">
        {isolateAction === 'isolateHost' ? ISOLATE_HOST : UNISOLATE_HOST}
        <EuiSpacer size="s" />
        <AgentTypeIntegration
          agentType={agentType}
          layout="horizontal"
          data-test-subj="flyoutHostIsolationHeaderIntegration"
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );

  return (
    <FlyoutHeader>
      <EuiTitle size="s">
        <h4 data-test-subj={FLYOUT_HEADER_TITLE_TEST_ID}>{title}</h4>
      </EuiTitle>
    </FlyoutHeader>
  );
};
