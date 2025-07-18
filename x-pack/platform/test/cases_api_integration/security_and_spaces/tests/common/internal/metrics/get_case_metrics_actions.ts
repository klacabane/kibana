/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { CaseMetricsFeature } from '@kbn/cases-plugin/common';
import { getPostCaseRequest, postCommentActionsReq } from '../../../../../common/lib/mock';

import type { FtrProviderContext } from '../../../../../common/ftr_provider_context';
import {
  createCase,
  createComment,
  deleteAllCaseItems,
  getCaseMetrics,
} from '../../../../../common/lib/api';

export default ({ getService }: FtrProviderContext): void => {
  const supertest = getService('supertest');
  const es = getService('es');

  describe('case action metrics', () => {
    describe('isolateHost action', () => {
      afterEach(async () => {
        await deleteAllCaseItems(es);
      });

      it('responds with zero values if no actions attached to a case', async () => {
        const theCase = await createCase(supertest, getPostCaseRequest());

        const metrics = await getCaseMetrics({
          supertest,
          caseId: theCase.id,
          features: [CaseMetricsFeature.ACTIONS_ISOLATE_HOST],
        });

        expect(metrics).to.eql({
          actions: {
            isolateHost: {
              isolate: { total: 0 },
              unisolate: { total: 0 },
            },
          },
        });
      });

      it('responds with total count for each isolate/unisolate actions attached to a case', async () => {
        const theCase = await createCase(supertest, getPostCaseRequest());

        await createComment({ supertest, caseId: theCase.id, params: postCommentActionsReq });
        await createComment({ supertest, caseId: theCase.id, params: postCommentActionsReq });
        await createComment({
          supertest,
          caseId: theCase.id,
          params: {
            ...postCommentActionsReq,
            actions: {
              ...postCommentActionsReq.actions,
              type: 'unisolate',
            },
          },
        });

        const metrics = await getCaseMetrics({
          supertest,
          caseId: theCase.id,
          features: [CaseMetricsFeature.ACTIONS_ISOLATE_HOST],
        });

        expect(metrics).to.eql({
          actions: {
            isolateHost: {
              isolate: { total: 2 },
              unisolate: { total: 1 },
            },
          },
        });
      });

      it('responds with total count for each isolate/unisolate actions attached to a case with different hosts', async () => {
        const theCase = await createCase(supertest, getPostCaseRequest());

        await createComment({ supertest, caseId: theCase.id, params: postCommentActionsReq });
        await createComment({
          supertest,
          caseId: theCase.id,
          params: {
            ...postCommentActionsReq,
            actions: {
              targets: [
                {
                  hostname: 'hostname-2',
                  endpointId: 'endpointId-2',
                },
              ],
              type: 'isolate',
            },
          },
        });

        const metrics = await getCaseMetrics({
          supertest,
          caseId: theCase.id,
          features: [CaseMetricsFeature.ACTIONS_ISOLATE_HOST],
        });

        expect(metrics).to.eql({
          actions: {
            isolateHost: {
              isolate: { total: 2 },
              unisolate: { total: 0 },
            },
          },
        });
      });
    });
  });
};
