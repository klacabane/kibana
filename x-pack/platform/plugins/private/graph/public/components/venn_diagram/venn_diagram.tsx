/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { css } from '@emotion/react';
import { type UseEuiTheme } from '@elastic/eui';
import { distanceFromIntersectArea } from './vennjs';

export interface VennDiagramProps {
  leftValue: number;
  rightValue: number;
  overlap: number;
}

function getRadius(area: number) {
  return Math.sqrt(area / Math.PI);
}

export function VennDiagram({ leftValue, rightValue, overlap }: VennDiagramProps) {
  const leftRadius = getRadius(leftValue);
  const rightRadius = getRadius(rightValue);

  const maxRadius = Math.max(leftRadius, rightRadius);

  const imageHeight = maxRadius * 2;
  const imageWidth = maxRadius * 4;

  const leftCenter = leftRadius;
  const rightCenter = leftCenter + distanceFromIntersectArea(leftRadius, rightRadius, overlap);

  // blank width is what's left after the right venn circle - it is used as padding
  const blankWidth = imageWidth - (rightCenter + rightRadius);
  const padding = blankWidth / 2;

  const viewBoxDims = `0 0 ${imageWidth} ${imageHeight}`;

  return (
    <div>
      <svg xmlns="http://www.w3.org/2000/svg" width={100} height={60} viewBox={viewBoxDims}>
        <g>
          <circle
            cx={leftCenter + padding}
            cy={maxRadius}
            r={leftRadius}
            className="gphVennDiagram__left"
            css={styles.left}
          />
          <circle
            cx={rightCenter + padding}
            cy={maxRadius}
            r={rightRadius}
            className="gphVennDiagram__right"
            css={styles.right}
          />
        </g>
      </svg>
    </div>
  );
}

const styles = {
  left: ({ euiTheme }: UseEuiTheme) =>
    css`
      fill: ${euiTheme.colors.danger};
      fill-opacity: 0.5;
    `,

  right: ({ euiTheme }: UseEuiTheme) => css`
    fill: ${euiTheme.colors.primary};
    fill-opacity: 0.5;
  `,
};
