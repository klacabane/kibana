/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../ftr_provider_context';

export default function ({ getPageObjects, getService }: FtrProviderContext) {
  const kibanaServer = getService('kibanaServer');
  const security = getService('security');
  const PageObjects = getPageObjects(['common', 'settings', 'security']);
  const appsMenu = getService('appsMenu');
  const managementMenu = getService('managementMenu');

  describe('security', () => {
    before(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
      await PageObjects.common.navigateToApp('home');
    });

    after(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
    });

    describe('global all privileges (aka kibana_admin)', () => {
      before(async () => {
        await security.testUser.setRoles(['kibana_admin']);
      });
      after(async () => {
        await security.testUser.restoreDefaults();
      });

      it('should show the Stack Management nav link', async () => {
        const links = await appsMenu.readLinks();
        expect(links.map((link) => link.text)).to.contain('Stack Management');
      });

      describe('"Data" section', function () {
        this.tags('skipFIPS');
        it('should render only data_quality section', async () => {
          await PageObjects.common.navigateToApp('management');
          const sections = await managementMenu.getSections();

          const sectionIds = sections.map((section) => section.sectionId);
          expect(sectionIds).to.contain('data');
          expect(sectionIds).to.contain('insightsAndAlerting');
          expect(sectionIds).to.contain('kibana');

          const dataSection = sections.find((section) => section.sectionId === 'data');
          expect(dataSection?.sectionLinks).to.eql(['data_quality', 'content_connectors']);
        });
      });
    });

    describe('global dashboard read with index_management_user', () => {
      before(async () => {
        await security.testUser.setRoles(['global_dashboard_read', 'index_management_user']);
      });
      after(async () => {
        await security.testUser.restoreDefaults();
      });
      it('should show the Stack Management nav link', async () => {
        const links = await appsMenu.readLinks();
        expect(links.map((link) => link.text)).to.contain('Stack Management');
      });

      describe('"Data" section with index management', function () {
        this.tags('skipFIPS');
        it('should render', async () => {
          await PageObjects.common.navigateToApp('management');
          const sections = await managementMenu.getSections();

          // The index_management_user has been given permissions to advanced settings for Stack Management Tests.
          // https://github.com/elastic/kibana/pull/113078/
          expect(sections).to.have.length(2);
          expect(sections[0]).to.eql({
            sectionId: 'data',
            sectionLinks: ['index_management', 'transform'],
          });
        });
      });
    });
  });
}
