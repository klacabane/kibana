/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';

import { coreMock } from '@kbn/core/public/mocks';
import { mockIndexPattern } from '../../../../../../common/mock';
import { TestProviders } from '../../../../../../common/mock/test_providers';
import { FilterManager } from '@kbn/data-plugin/public';
import { mockDataProviders } from '../../../data_providers/mock/mock_data_providers';
import { useMountAppended } from '../../../../../../common/utils/use_mount_appended';

import { QueryTabHeader } from '.';
import { TimelineStatusEnum, TimelineTypeEnum } from '../../../../../../../common/api/timeline';
import { waitFor } from '@testing-library/react';
import { TimelineId, TimelineTabs } from '../../../../../../../common/types';

const mockUiSettingsForFilterManager = coreMock.createStart().uiSettings;

jest.mock('../../../../../../common/lib/kibana');

// FLAKY: https://github.com/elastic/kibana/issues/195830
describe.skip('Header', () => {
  const indexPattern = mockIndexPattern;
  const mount = useMountAppended();
  const getWrapper = async (childrenComponent: JSX.Element) => {
    const wrapper = mount(childrenComponent);
    await waitFor(() => wrapper.find('[data-test-subj="timelineCallOutUnauthorized"]').exists());
    return wrapper;
  };
  const props = {
    activeTab: TimelineTabs.query,
    showEventsCountBadge: true,
    totalCount: 1,
    browserFields: {},
    dataProviders: mockDataProviders,
    filterManager: new FilterManager(mockUiSettingsForFilterManager),
    indexPattern,
    onDataProviderEdited: jest.fn(),
    onDataProviderRemoved: jest.fn(),
    onToggleDataProviderEnabled: jest.fn(),
    onToggleDataProviderExcluded: jest.fn(),
    onToggleDataProviderType: jest.fn(),
    show: true,
    showCallOutUnauthorizedMsg: false,
    status: TimelineStatusEnum.active,
    timelineId: TimelineId.test,
    timelineType: TimelineTypeEnum.default,
  };

  describe('rendering', () => {
    test('it renders the data providers when show is true', async () => {
      const testProps = { ...props, show: true };
      const wrapper = await getWrapper(
        <TestProviders>
          <QueryTabHeader {...testProps} />
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="dataProviders"]').exists()).toEqual(true);
    });

    test('it renders the unauthorized call out providers', async () => {
      const testProps = {
        ...props,
        filterManager: new FilterManager(mockUiSettingsForFilterManager),
        showCallOutUnauthorizedMsg: true,
      };

      const wrapper = await getWrapper(
        <TestProviders>
          <QueryTabHeader {...testProps} />
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="timelineCallOutUnauthorized"]').exists()).toEqual(true);
    });

    test('it renders the unauthorized call out with correct icon', async () => {
      const testProps = {
        ...props,
        filterManager: new FilterManager(mockUiSettingsForFilterManager),
        showCallOutUnauthorizedMsg: true,
      };

      const wrapper = await getWrapper(
        <TestProviders>
          <QueryTabHeader {...testProps} />
        </TestProviders>
      );

      expect(
        wrapper.find('[data-test-subj="timelineCallOutUnauthorized"]').first().prop('iconType')
      ).toEqual('warning');
    });

    test('it renders the unauthorized call out with correct message', async () => {
      const testProps = {
        ...props,
        filterManager: new FilterManager(mockUiSettingsForFilterManager),
        showCallOutUnauthorizedMsg: true,
      };

      const wrapper = await getWrapper(
        <TestProviders>
          <QueryTabHeader {...testProps} />
        </TestProviders>
      );

      expect(
        wrapper.find('[data-test-subj="timelineCallOutUnauthorized"]').first().prop('title')
      ).toEqual(
        'You can use Timeline to investigate events, but you do not have the required permissions to save timelines for future use. If you need to save timelines, contact your Kibana administrator.'
      );
    });

    test('it renders the immutable timeline call out providers', async () => {
      const testProps = {
        ...props,
        filterManager: new FilterManager(mockUiSettingsForFilterManager),
        showCallOutUnauthorizedMsg: false,
        status: TimelineStatusEnum.immutable,
      };

      const wrapper = await getWrapper(
        <TestProviders>
          <QueryTabHeader {...testProps} />
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="timelineImmutableCallOut"]').exists()).toEqual(true);
    });

    test('it renders the immutable timeline call out with correct icon', async () => {
      const testProps = {
        ...props,
        filterManager: new FilterManager(mockUiSettingsForFilterManager),
        showCallOutUnauthorizedMsg: false,
        status: TimelineStatusEnum.immutable,
      };

      const wrapper = await getWrapper(
        <TestProviders>
          <QueryTabHeader {...testProps} />
        </TestProviders>
      );

      expect(
        wrapper.find('[data-test-subj="timelineImmutableCallOut"]').first().prop('iconType')
      ).toEqual('warning');
    });

    test('it renders the immutable timeline call out with correct message', async () => {
      const testProps = {
        ...props,
        filterManager: new FilterManager(mockUiSettingsForFilterManager),
        showCallOutUnauthorizedMsg: false,
        status: TimelineStatusEnum.immutable,
      };

      const wrapper = await getWrapper(
        <TestProviders>
          <QueryTabHeader {...testProps} />
        </TestProviders>
      );

      expect(
        wrapper.find('[data-test-subj="timelineImmutableCallOut"]').first().prop('title')
      ).toEqual(
        'This prebuilt timeline template cannot be modified. To make changes, please duplicate this template and make modifications to the duplicate template.'
      );
    });
  });
});
