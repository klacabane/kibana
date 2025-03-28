/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { action } from '@storybook/addon-actions';
import React from 'react';
import { EditorMenu } from '../editor_menu.component';

export default {
  title: 'components/WorkpadHeader/EditorMenu',
};

export const Default = {
  render: () => (
    <EditorMenu
      addPanelActions={[]}
      createNewEmbeddableFromAction={() => action('createNewEmbeddableFromAction')}
    />
  ),

  name: 'default',
};
