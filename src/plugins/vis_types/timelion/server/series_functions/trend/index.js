/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { i18n } from '@kbn/i18n';
import _ from 'lodash';
import Chainable from '../../lib/classes/chainable';
import { linear, log } from './lib/regress';

const validRegressions = {
  linear: 'linear',
  log: 'logarithmic',
};

export default new Chainable('trend', {
  args: [
    {
      name: 'inputSeries',
      types: ['seriesList'],
    },
    {
      name: 'mode',
      types: ['string'],
      help: i18n.translate('timelion.help.functions.trend.args.modeHelpText', {
        defaultMessage:
          'The algorithm to use for generating the trend line. One of: {validRegressions}',
        values: {
          validRegressions: _.keys(validRegressions).join(', '),
        },
      }),
      suggestions: _.keys(validRegressions).map((key) => {
        return { name: key, help: validRegressions[key] };
      }),
    },
    {
      name: 'start',
      types: ['number', 'null'],
      help: i18n.translate('timelion.help.functions.trend.args.startHelpText', {
        defaultMessage:
          'Where to start calculating from the beginning or end. For example -10 would start ' +
          'calculating 10 points from the end, +15 would start 15 points from the beginning. Default: 0',
      }),
    },
    {
      name: 'end',
      types: ['number', 'null'],
      help: i18n.translate('timelion.help.functions.trend.args.endHelpText', {
        defaultMessage:
          'Where to stop calculating from the beginning or end. For example -10 would stop ' +
          'calculating 10 points from the end, +15 would stop 15 points from the beginning. Default: 0',
      }),
    },
  ],
  help: i18n.translate('timelion.help.functions.trendHelpText', {
    defaultMessage: 'Draws a trend line using a specified regression algorithm',
  }),
  fn: function absFn(args) {
    const newSeries = _.cloneDeep(args.byName.inputSeries);

    _.each(newSeries.list, function (series) {
      const length = series.data.length;
      let start = args.byName.start == null ? 0 : args.byName.start;
      let end = args.byName.end == null ? length : args.byName.end;
      start = start >= 0 ? start : length + start;
      end = end > 0 ? end : length + end;

      const subset = series.data.slice(start, end);

      const result = args.byName.mode === 'log' ? log(subset) : linear(subset);

      _.each(series.data, function (point) {
        point[1] = null;
      });

      _.each(result, function (point, i) {
        series.data[start + i] = point;
      });
    });
    return newSeries;
  },
});
