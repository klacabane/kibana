/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { CoreSetup, CoreStart, Plugin } from '@kbn/core/server';
import type { DataPluginSetup, DataPluginStart } from '@kbn/data-plugin/server/plugin';
import type { CasesServerSetup } from '@kbn/cases-plugin/server';

export interface ThreatIntelligencePluginSetupDependencies {
  data: DataPluginSetup;
  cases: CasesServerSetup;
}

export interface ThreatIntelligencePluginStartDependencies {
  data: DataPluginStart;
}

export type ThreatIntelligencePluginCoreSetupDependencies = CoreSetup<
  ThreatIntelligencePluginStartDependencies,
  {}
>;

export type ThreatIntelligencePluginCoreStartDependencies = CoreStart;

export type IThreatIntelligencePlugin = Plugin<
  {},
  {},
  ThreatIntelligencePluginSetupDependencies,
  ThreatIntelligencePluginStartDependencies
>;
