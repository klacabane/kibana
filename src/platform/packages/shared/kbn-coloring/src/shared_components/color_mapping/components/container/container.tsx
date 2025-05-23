/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { EuiFlexGroup, EuiFlexItem, EuiFormRow, EuiButtonIcon, EuiToolTip } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { css } from '@emotion/react';
import { KbnPalettes } from '@kbn/palettes';
import { IFieldFormat } from '@kbn/field-formats-plugin/common';
import { PaletteSelector } from '../palette_selector/palette_selector';

import { changeGradientSortOrder } from '../../state/color_mapping';
import { selectColorMode, selectComputedAssignments, selectPalette } from '../../state/selectors';
import { ColorMappingInputData } from '../../categorical_color_mapping';
import { Gradient } from '../palette_selector/gradient';
import { ScaleMode } from '../palette_selector/scale';
import { UnassignedTermsConfig } from './unassigned_terms_config';
import { Assignments } from './assignments';

export function Container({
  data,
  palettes,
  isDarkMode,
  specialTokens,
  formatter,
  allowCustomMatch,
}: {
  palettes: KbnPalettes;
  data: ColorMappingInputData;
  isDarkMode: boolean;
  /** map between original and formatted tokens used to handle special cases, like the Other bucket and the empty bucket */
  specialTokens: Map<string, string>;
  formatter?: IFieldFormat;
  allowCustomMatch?: boolean;
}) {
  const dispatch = useDispatch();
  const palette = useSelector(selectPalette(palettes));
  const colorMode = useSelector(selectColorMode);
  const assignments = useSelector(selectComputedAssignments);

  return (
    <EuiFlexGroup direction="column" gutterSize="m" justifyContent="flexStart">
      <EuiFlexItem>
        <EuiFlexGroup
          direction="row"
          alignItems="center"
          justifyContent="spaceBetween"
          gutterSize="s"
        >
          <EuiFlexItem>
            <PaletteSelector palettes={palettes} />
          </EuiFlexItem>
          <EuiFlexItem grow={0}>
            <ScaleMode palettes={palettes} />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexItem>
      {colorMode.type === 'gradient' && (
        <EuiFlexItem style={{ position: 'relative' }}>
          <div
            css={css`
              position: absolute;
              right: 0;
            }`}
          >
            <EuiToolTip
              position="top"
              content={i18n.translate('coloring.colorMapping.container.invertGradientButtonLabel', {
                defaultMessage: 'Invert gradient',
              })}
            >
              <EuiButtonIcon
                data-test-subj="lns-colorMapping-invertGradient"
                color="text"
                iconType="merge"
                size="xs"
                aria-label={i18n.translate(
                  'coloring.colorMapping.container.invertGradientButtonLabel',
                  {
                    defaultMessage: 'Invert gradient',
                  }
                )}
                onClick={() => {
                  dispatch(changeGradientSortOrder(colorMode.sort === 'asc' ? 'desc' : 'asc'));
                }}
              />
            </EuiToolTip>
          </div>
          <EuiFormRow
            fullWidth
            label={i18n.translate('coloring.colorMapping.container.gradientHeader', {
              defaultMessage: 'Gradient',
            })}
          >
            <Gradient
              colorMode={colorMode}
              palettes={palettes}
              isDarkMode={isDarkMode}
              paletteId={palette.id}
            />
          </EuiFormRow>
        </EuiFlexItem>
      )}

      <EuiFlexItem>
        <EuiFormRow
          fullWidth
          label={i18n.translate('coloring.colorMapping.container.mappingAssignmentHeader', {
            defaultMessage: 'Color assignments',
          })}
        >
          <Assignments
            isDarkMode={isDarkMode}
            data={data}
            palettes={palettes}
            specialTokens={specialTokens}
            formatter={formatter}
            allowCustomMatch={allowCustomMatch}
          />
        </EuiFormRow>
      </EuiFlexItem>
      {assignments.length > 0 && (
        <EuiFlexItem>
          <UnassignedTermsConfig data={data} isDarkMode={isDarkMode} palettes={palettes} />
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  );
}
