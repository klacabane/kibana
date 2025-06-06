/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ReactNode, ComponentType } from 'react';
import type { ChromeProjectNavigationNode, PanelSelectedNode } from '@kbn/core-chrome-browser';

export interface PanelComponentProps {
  /** Handler to close the panel */
  closePanel: () => void;
  /** The node in the main panel that opens the secondary panel */
  selectedNode: PanelSelectedNode;
  /** Jagged array of active nodes that match the current URL location  */
  activeNodes: ChromeProjectNavigationNode[][];
}

export interface PanelContent {
  title?: ReactNode | string;
  content?: ComponentType<PanelComponentProps>;
}
