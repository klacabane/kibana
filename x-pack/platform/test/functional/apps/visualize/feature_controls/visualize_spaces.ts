/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { VisualizeConstants } from '@kbn/visualizations-plugin/common/constants';
import { FtrProviderContext } from '../../../ftr_provider_context';

export default function ({ getPageObjects, getService }: FtrProviderContext) {
  const esArchiver = getService('esArchiver');
  const kibanaServer = getService('kibanaServer');
  const config = getService('config');
  const spacesService = getService('spaces');
  const { common, error } = getPageObjects(['common', 'error']);
  const testSubjects = getService('testSubjects');
  const appsMenu = getService('appsMenu');

  describe('visualize spaces', () => {
    before(async () => {
      await esArchiver.loadIfNeeded('x-pack/test/functional/es_archives/logstash_functional');
      await esArchiver.loadIfNeeded('x-pack/test/functional/es_archives/visualize/default');
    });

    describe('space with no features disabled', () => {
      before(async () => {
        // we need to load the following in every situation as deleting
        // a space deletes all of the associated saved objects
        await kibanaServer.savedObjects.cleanStandardList();
        await kibanaServer.importExport.load(
          'x-pack/test/functional/fixtures/kbn_archiver/visualize/default'
        );
        await spacesService.create({
          id: 'custom_space',
          name: 'custom_space',
          disabledFeatures: [],
        });
        await kibanaServer.importExport.load(
          'x-pack/test/functional/fixtures/kbn_archiver/visualize/custom_space',
          { space: 'custom_space' }
        );
      });

      after(async () => {
        await spacesService.delete('custom_space');
        await kibanaServer.savedObjects.cleanStandardList();
      });

      it('shows visualize navlink', async () => {
        await common.navigateToApp('home', {
          basePath: '/s/custom_space',
        });
        const navLinks = (await appsMenu.readLinks()).map((link) => link.text);
        expect(navLinks).to.contain('Visualize library');
      });

      it(`can view existing Visualization`, async () => {
        await common.navigateToActualUrl(
          'visualize',
          `${VisualizeConstants.EDIT_PATH}/custom_i-exist`,
          {
            basePath: '/s/custom_space',
            ensureCurrentUrl: false,
            shouldLoginIfPrompted: false,
          }
        );
        await testSubjects.existOrFail('visualizationLoader', {
          timeout: config.get('timeouts.waitFor'),
        });
      });
    });

    describe('space with Visualize disabled', () => {
      before(async () => {
        // we need to load the following in every situation as deleting
        // a space deletes all of the associated saved objects
        await kibanaServer.savedObjects.cleanStandardList();
        await kibanaServer.importExport.load(
          'x-pack/test/functional/fixtures/kbn_archiver/visualize/default'
        );
        await spacesService.create({
          id: 'custom_space',
          name: 'custom_space',
          disabledFeatures: ['visualize'],
        });
      });

      after(async () => {
        await spacesService.delete('custom_space');
        await kibanaServer.savedObjects.cleanStandardList();
      });

      it(`doesn't show visualize navlink`, async () => {
        await common.navigateToApp('home', {
          basePath: '/s/custom_space',
        });
        const navLinks = (await appsMenu.readLinks()).map((link) => link.text);
        expect(navLinks).not.to.contain('Visualize library');
      });

      it(`create new visualization shows 404`, async () => {
        await common.navigateToActualUrl('visualize', VisualizeConstants.CREATE_PATH, {
          basePath: '/s/custom_space',
          ensureCurrentUrl: false,
          shouldLoginIfPrompted: false,
        });
        await error.expectNotFound();
      });

      it(`edit visualization for object which doesn't exist shows 404`, async () => {
        await common.navigateToActualUrl(
          'visualize',
          `${VisualizeConstants.EDIT_PATH}/i-dont-exist`,
          {
            basePath: '/s/custom_space',
            ensureCurrentUrl: false,
            shouldLoginIfPrompted: false,
          }
        );
        await error.expectNotFound();
      });

      it(`edit visualization for object which exists shows 404`, async () => {
        await common.navigateToActualUrl('visualize', `${VisualizeConstants.EDIT_PATH}/i-exist`, {
          basePath: '/s/custom_space',
          ensureCurrentUrl: false,
          shouldLoginIfPrompted: false,
        });
        await error.expectNotFound();
      });
    });
  });
}
