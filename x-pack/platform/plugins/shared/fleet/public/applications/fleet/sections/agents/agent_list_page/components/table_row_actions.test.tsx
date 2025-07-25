/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { fireEvent } from '@testing-library/react';

import { createFleetTestRendererMock } from '../../../../../../mock';
import type { Agent, AgentPolicy } from '../../../../types';
import { ExperimentalFeaturesService } from '../../../../services';
import { useAuthz } from '../../../../../../hooks/use_authz';
import { useAgentVersion } from '../../../../../../hooks/use_agent_version';

import { TableRowActions } from './table_row_actions';

jest.mock('../../../../../../services/experimental_features');
jest.mock('../../../../../../hooks/use_authz');
jest.mock('../../../../../../hooks/use_agent_version');

const mockedExperimentalFeaturesService = jest.mocked(ExperimentalFeaturesService);
const mockedUseAuthz = jest.mocked(useAuthz);
const mockedUseAgentVersion = jest.mocked(useAgentVersion);

function renderTableRowActions({
  agent,
  agentPolicy,
}: {
  agent: Agent;
  agentPolicy?: AgentPolicy;
}) {
  const renderer = createFleetTestRendererMock();

  const utils = renderer.render(
    <TableRowActions
      agent={agent}
      agentPolicy={agentPolicy}
      onAddRemoveTagsClick={jest.fn()}
      onReassignClick={jest.fn()}
      onRequestDiagnosticsClick={jest.fn()}
      onUnenrollClick={jest.fn()}
      onUpgradeClick={jest.fn()}
      onGetUninstallCommandClick={jest.fn()}
      onMigrateAgentClick={jest.fn()}
    />
  );

  fireEvent.click(utils.getByTestId('agentActionsBtn'));

  return { utils };
}
describe('TableRowActions', () => {
  beforeEach(() => {
    mockedExperimentalFeaturesService.get.mockReturnValue({ enableAgentMigrations: true } as any); // mock the flag as true so the test runs and the table action item renders
    mockedUseAuthz.mockReturnValue({
      fleet: {
        all: true,
        readAgents: true,
        allAgents: true,
      },
      integrations: {},
    } as any);
    mockedUseAgentVersion.mockReturnValue('8.10.2');
  });

  describe('Migrate agent action', () => {
    function renderAndGetMigrateButton({
      agent,
      agentPolicy,
    }: {
      agent: Agent;
      agentPolicy?: AgentPolicy;
    }) {
      const { utils } = renderTableRowActions({
        agent,
        agentPolicy,
      });

      return utils.queryByTestId('migrateAgentMenuItem');
    }

    it('should render an active action button when agent isnt protected', async () => {
      const res = renderAndGetMigrateButton({
        agent: {
          active: true,
          status: 'online',
          local_metadata: { elastic: { agent: { version: '8.8.0' } } },
        } as any,
        agentPolicy: {
          is_managed: false,
          is_protected: false,
        } as AgentPolicy,
      });

      expect(res).not.toBe(null);
      expect(res).toBeEnabled();
    });

    it('should not render an active action button when agent is protected by policy', async () => {
      const res = renderAndGetMigrateButton({
        agent: {
          active: true,
          status: 'online',
          local_metadata: { elastic: { agent: { version: '8.8.0' } } },
        } as any,
        agentPolicy: {
          is_managed: false,
          is_protected: true,
        } as AgentPolicy,
      });

      expect(res).toBe(null);
    });

    it('should not render an active action button when agent is a fleet server agent', async () => {
      const res = renderAndGetMigrateButton({
        agent: {
          active: true,
          status: 'online',
          components: [{ type: 'fleet-server' }],
        } as any,
        agentPolicy: {
          is_managed: true,
          is_protected: false,
          package_policies: [{ package: { name: 'fleet_server' } }],
        } as AgentPolicy,
      });

      expect(res).toBe(null);
    });
    it('should not render an active action button when feature flag is disabled', async () => {
      mockedExperimentalFeaturesService.get.mockReturnValue({
        enableAgentMigrations: false,
      } as any);
      const res = renderAndGetMigrateButton({
        agent: {
          active: true,
          status: 'online',
          local_metadata: { elastic: { agent: { version: '8.8.0' } } },
        } as any,
        agentPolicy: {
          is_managed: false,
          is_protected: false,
        } as AgentPolicy,
      });

      expect(res).toBe(null);
    });
  });

  describe('Request Diagnotics action', () => {
    function renderAndGetDiagnosticsButton({
      agent,
      agentPolicy,
    }: {
      agent: Agent;
      agentPolicy?: AgentPolicy;
    }) {
      const { utils } = renderTableRowActions({
        agent,
        agentPolicy,
      });

      return utils.queryByTestId('requestAgentDiagnosticsBtn');
    }

    it('should not render action if authz do not have Agents:All', async () => {
      mockedUseAuthz.mockReturnValue({
        fleet: {
          allAgents: false,
        },
        integrations: {},
      } as any);
      const res = renderAndGetDiagnosticsButton({
        agent: {
          active: true,
          status: 'online',
          local_metadata: { elastic: { agent: { version: '8.8.0' } } },
        } as any,
        agentPolicy: {} as AgentPolicy,
      });
      expect(res).toBe(null);
    });

    it('should render an active action button if agent version >= 8.7', async () => {
      const res = renderAndGetDiagnosticsButton({
        agent: {
          active: true,
          status: 'online',
          local_metadata: { elastic: { agent: { version: '8.8.0' } } },
        } as any,
        agentPolicy: {} as AgentPolicy,
      });

      expect(res).not.toBe(null);
      expect(res).toBeEnabled();
    });

    it('should render an active action button if agent version >= 8.7 and policy is_managed', async () => {
      const res = renderAndGetDiagnosticsButton({
        agent: {
          active: true,
          status: 'online',
          local_metadata: { elastic: { agent: { version: '8.8.0' } } },
        } as any,
        agentPolicy: {
          is_managed: true,
        } as AgentPolicy,
      });

      expect(res).not.toBe(null);
      expect(res).toBeEnabled();
    });

    it('should render a disabled action button if agent version < 8.7', async () => {
      const res = renderAndGetDiagnosticsButton({
        agent: {
          active: true,
          status: 'online',
          local_metadata: { elastic: { agent: { version: '8.6.0' } } },
        } as any,
        agentPolicy: {
          is_managed: true,
        } as AgentPolicy,
      });

      expect(res).not.toBe(null);
      expect(res).not.toBeEnabled();
    });
  });

  describe('Restart upgrade action', () => {
    function renderAndGetRestartUpgradeButton({
      agent,
      agentPolicy,
    }: {
      agent: Agent;
      agentPolicy?: AgentPolicy;
    }) {
      const { utils } = renderTableRowActions({
        agent,
        agentPolicy,
      });

      return utils.queryByTestId('restartUpgradeBtn');
    }

    it('should render an active button', async () => {
      const res = renderAndGetRestartUpgradeButton({
        agent: {
          active: true,
          status: 'updating',
          upgrade_started_at: '2022-11-21T12:27:24Z',
        } as any,
        agentPolicy: {
          is_managed: false,
        } as AgentPolicy,
      });

      expect(res).not.toBe(null);
      expect(res).toBeEnabled();
    });
    it('should not render action if authz do not have Agents:Read', async () => {
      mockedUseAuthz.mockReturnValue({
        fleet: {
          readAgents: false,
        },
        integrations: {},
      } as any);
      const res = renderAndGetRestartUpgradeButton({
        agent: {
          active: true,
          status: 'updating',
          upgrade_started_at: '2022-11-21T12:27:24Z',
        } as any,
        agentPolicy: {
          is_managed: false,
        } as AgentPolicy,
      });

      expect(res).toBe(null);
    });

    it('should not render action if agent is not stuck in updating', async () => {
      const res = renderAndGetRestartUpgradeButton({
        agent: {
          active: true,
          status: 'updating',
          upgrade_started_at: new Date().toISOString(),
        } as any,
        agentPolicy: {
          is_managed: false,
        } as AgentPolicy,
      });
      expect(res).toBe(null);
    });
  });

  describe('Upgrade action', () => {
    function renderAndGetUpgradeButton({
      agent,
      agentPolicy,
    }: {
      agent: Agent;
      agentPolicy?: AgentPolicy;
    }) {
      const { utils } = renderTableRowActions({
        agent,
        agentPolicy,
      });

      return utils.queryByTestId('upgradeBtn');
    }

    it('should render an active action button if agent version is not the latest', async () => {
      const res = renderAndGetUpgradeButton({
        agent: {
          active: true,
          status: 'online',
          local_metadata: { elastic: { agent: { version: '8.8.0', upgradeable: true } } },
        } as any,
        agentPolicy: {
          is_managed: false,
        } as AgentPolicy,
      });

      expect(res).not.toBe(null);
      expect(res).toBeEnabled();
    });

    it('should render an enabled action button if agent version is latest', async () => {
      const res = renderAndGetUpgradeButton({
        agent: {
          active: true,
          status: 'online',
          local_metadata: { elastic: { agent: { version: '8.10.2', upgradeable: true } } },
        } as any,
        agentPolicy: {
          is_managed: false,
        } as AgentPolicy,
      });

      expect(res).not.toBe(null);
      expect(res).toBeEnabled();
    });
  });
});
