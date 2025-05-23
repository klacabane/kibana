/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { ComponentProps } from 'react';
import { EuiToast } from '@elastic/eui';
import type { AnalyticsServiceStart, AnalyticsServiceSetup } from '@kbn/core-analytics-browser';
import { EventMetric, FieldType, eventTypes } from './event_types';

type ToastMessageType = Exclude<ComponentProps<typeof EuiToast>['color'], 'success'>;

interface EventPayload {
  [FieldType.RECURRENCE_COUNT]: number;
  [FieldType.TOAST_MESSAGE]: string;
  [FieldType.TOAST_MESSAGE_TYPE]: ToastMessageType;
}

export class ToastsTelemetry {
  private reportEvent?: AnalyticsServiceStart['reportEvent'];

  public setup({ analytics }: { analytics: AnalyticsServiceSetup }) {
    eventTypes.forEach((eventType) => {
      analytics.registerEventType(eventType);
    });

    return {};
  }

  public start({ analytics }: { analytics: AnalyticsServiceStart }) {
    this.reportEvent = analytics.reportEvent;

    return {
      onDismissToast: this.onDismissToast.bind(this),
    };
  }

  private onDismissToast({
    recurrenceCount,
    toastMessage,
    toastMessageType,
  }: {
    toastMessage: string;
    recurrenceCount: number;
    toastMessageType: ToastMessageType;
  }) {
    this.reportEvent<EventPayload>?.(EventMetric.TOAST_DISMISSED, {
      [FieldType.RECURRENCE_COUNT]: recurrenceCount,
      [FieldType.TOAST_MESSAGE]: toastMessage,
      [FieldType.TOAST_MESSAGE_TYPE]: toastMessageType,
    });
  }
}
