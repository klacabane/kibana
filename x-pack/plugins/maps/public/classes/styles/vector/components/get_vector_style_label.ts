/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';

import { VECTOR_STYLES } from '../../../../../common/constants';

export function getDisabledByMessage(styleName: VECTOR_STYLES) {
  return i18n.translate('xpack.maps.styles.vector.disabledByMessage', {
    defaultMessage: `Set ''{styleLabel}'' to enable`,
    values: { styleLabel: getVectorStyleLabel(styleName) },
  });
}

export function getVectorStyleLabel(styleName: VECTOR_STYLES) {
  switch (styleName) {
    case VECTOR_STYLES.FILL_COLOR:
      return i18n.translate('xpack.maps.styles.vector.fillColorLabel', {
        defaultMessage: 'Fill color',
      });
    case VECTOR_STYLES.LINE_COLOR:
      return i18n.translate('xpack.maps.styles.vector.borderColorLabel', {
        defaultMessage: 'Border color',
      });
    case VECTOR_STYLES.LINE_WIDTH:
      return i18n.translate('xpack.maps.styles.vector.borderWidthLabel', {
        defaultMessage: 'Border width',
      });
    case VECTOR_STYLES.ICON:
      return i18n.translate('xpack.maps.styles.vector.iconLabel', {
        defaultMessage: 'Icon',
      });
    case VECTOR_STYLES.ICON_SIZE:
      return i18n.translate('xpack.maps.styles.vector.symbolSizeLabel', {
        defaultMessage: 'Symbol size',
      });
    case VECTOR_STYLES.ICON_ORIENTATION:
      return i18n.translate('xpack.maps.styles.vector.orientationLabel', {
        defaultMessage: 'Symbol orientation',
      });
    case VECTOR_STYLES.LABEL_TEXT:
      return i18n.translate('xpack.maps.styles.vector.labelLabel', {
        defaultMessage: 'Label',
      });
    case VECTOR_STYLES.LABEL_ZOOM_RANGE:
      return i18n.translate('xpack.maps.styles.vector.labelZoomRangeLabel', {
        defaultMessage: 'Label visibility',
      });
    case VECTOR_STYLES.LABEL_COLOR:
      return i18n.translate('xpack.maps.styles.vector.labelColorLabel', {
        defaultMessage: 'Label color',
      });
    case VECTOR_STYLES.LABEL_SIZE:
      return i18n.translate('xpack.maps.styles.vector.labelSizeLabel', {
        defaultMessage: 'Label size',
      });
    case VECTOR_STYLES.LABEL_BORDER_COLOR:
      return i18n.translate('xpack.maps.styles.vector.labelBorderColorLabel', {
        defaultMessage: 'Label border color',
      });
    case VECTOR_STYLES.LABEL_BORDER_SIZE:
      return i18n.translate('xpack.maps.styles.vector.labelBorderWidthLabel', {
        defaultMessage: 'Label border width',
      });
    case VECTOR_STYLES.LABEL_POSITION:
      return i18n.translate('xpack.maps.styles.vector.labelPositionLabel', {
        defaultMessage: 'Label position',
      });
    default:
      return styleName;
  }
}
