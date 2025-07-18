/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import moment from 'moment';
import { getNthByWeekday } from './get_nth_by_weekday';

describe('generateNthByWeekday', () => {
  test('should parse the 4th tuesday', () => {
    expect(getNthByWeekday(moment('2021-11-23'))).toEqual('+4TU');
  });

  test('should parse the 3rd tuesday', () => {
    expect(getNthByWeekday(moment('2021-11-16'))).toEqual('+3TU');
  });

  test('should parse the last sunday of the month', () => {
    expect(getNthByWeekday(moment('2023-04-30'))).toEqual('-1SU');
  });
});
