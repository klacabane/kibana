/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export type { DataErrorsControl } from './src/types';
export { fetchFieldsFromESQL } from './src/fetch_fields_from_esql';
export type { ESQLEditorProps } from './src/esql_editor';
import { ESQLEditor } from './src/esql_editor';
export type { ESQLEditorRestorableState } from './src/restorable_state';

// React.lazy support
// eslint-disable-next-line import/no-default-export
export default ESQLEditor;
