/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import * as t from 'io-ts';
import { Either } from 'fp-ts/Either';

/**
 * Types the EmptyStringArray as:
 *   - A value that can be undefined, or null (which will be turned into an empty array)
 *   - A comma separated string that can turn into an array by splitting on it
 *   - Example input converted to output: undefined -> []
 *   - Example input converted to output: null -> []
 *   - Example input converted to output: "a,b,c" -> ["a", "b", "c"]
 */
export const EmptyStringArray = new t.Type<string[], string | undefined | null, unknown>(
  'EmptyStringArray',
  t.array(t.string).is,
  (input, context): Either<t.Errors, string[]> => {
    if (input == null) {
      return t.success([]);
    } else if (typeof input === 'string' && input.trim() !== '') {
      const arrayValues = input
        .trim()
        .split(',')
        .map((value) => value.trim());
      const emptyValueFound = arrayValues.some((value) => value === '');
      if (emptyValueFound) {
        return t.failure(input, context);
      } else {
        return t.success(arrayValues);
      }
    } else {
      return t.failure(input, context);
    }
  },
  String
);

export type EmptyStringArrayEncoded = t.OutputOf<typeof EmptyStringArray>;
export type EmptyStringArrayDecoded = t.TypeOf<typeof EmptyStringArray>;
