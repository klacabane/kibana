/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { metricVisFunction } from './metric_vis_function';
import type { MetricArguments } from '..';
import { functionWrapper } from '@kbn/expressions-plugin/common/expression_functions/specs/tests/utils';
import { Datatable } from '@kbn/expressions-plugin/common/expression_types/specs';
import { LabelPosition } from '../constants';
import { ExecutionContext } from '@kbn/expressions-plugin/common';

describe('interpreter/functions#metric', () => {
  const fn = functionWrapper(metricVisFunction());
  const context: Datatable = {
    type: 'datatable',
    rows: [{ 'col-0-1': 0 }],
    columns: [{ id: 'col-0-1', name: 'Count', meta: { type: 'number' } }],
  };
  let args: MetricArguments;
  beforeEach(() => {
    args = {
      percentageMode: false,
      colorMode: 'None',
      palette: {
        type: 'palette',
        name: '',
        params: {
          colors: ['rgba(0, 0, 0, 0)', 'rgb(112, 38, 231)'],
          stops: [0, 10000],
          gradient: false,
          rangeMin: 0,
          rangeMax: 150,
          range: 'number',
        },
      },
      colorFullBackground: false,
      showLabels: true,
      labelFont: { spec: { fontSize: '24px' }, type: 'style', css: '' },
      labelPosition: LabelPosition.BOTTOM,
      font: { spec: { fontSize: '60px' }, type: 'style', css: '' },
      metric: [
        {
          type: 'vis_dimension',
          accessor: 0,
          format: {
            id: 'number',
            params: {},
          },
        },
      ],
    };
  });

  it('returns an object with the correct structure', () => {
    const actual = fn(context, args);

    expect(actual).toMatchSnapshot();
  });

  it('logs correct datatable to inspector', async () => {
    let loggedTable: Datatable;
    const handlers = {
      inspectorAdapters: {
        tables: {
          logDatatable: (name: string, datatable: Datatable) => {
            loggedTable = datatable;
          },
          reset: () => {},
        },
      },
      getExecutionContext: jest.fn(),
    } as unknown as ExecutionContext;

    await fn(context, args, handlers);

    expect(loggedTable!).toMatchSnapshot();
  });

  it('returns error if bucket and colorFullBackground specified', () => {
    args.colorFullBackground = true;
    args.bucket = {
      type: 'vis_dimension',
      accessor: 0,
      format: {
        id: 'number',
        params: {},
      },
    };

    expect(() => fn(context, args)).toThrowErrorMatchingSnapshot();
  });

  it('ignores colorFullBackground setting if several metrics are specified', () => {
    args.colorFullBackground = true;
    args.metric.push({
      type: 'vis_dimension',
      accessor: 0,
      format: {
        id: 'number',
        params: {},
      },
    });

    expect(fn(context, args).value.visConfig.metric.colorFullBackground).toBeFalsy();
  });

  it('ignores colorFullBackground if data includes several rows', () => {
    args.colorFullBackground = true;
    context.rows.push({ 'col-0-1': 0 });

    expect(fn(context, args).value.visConfig.metric.colorFullBackground).toBeFalsy();
  });
});
