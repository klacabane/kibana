/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { EuiFlexGroup, EuiFlexItem, EuiPanel, EuiText } from '@elastic/eui';
import { css } from '@emotion/css';
import React from 'react';
import { InvestigateTextButton } from '../../../../components/investigate_text_button';
import { useTheme } from '../../../../hooks/use_theme';

export const GRID_ITEM_HEADER_HEIGHT = 40;

interface GridItemProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onCopy: () => void;
  onDelete: () => void;
  loading: boolean;
}

export type { GridItemProps };

const titleContainerClassName = css`
  overflow: hidden;
`;
const titleItemClassName = css`
  max-width: 100%;
  .euiText {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const panelClassName = css`
  overflow-y: auto;
`;

const panelContentClassName = css`
  overflow-y: auto;
  height: 100%;
`;

export function GridItem({ id, title, children, onDelete, onCopy, loading }: GridItemProps) {
  const theme = useTheme();

  const headerClassName = css`
  padding: 0 ${theme.size.s} 0 ${theme.size.s}};
`;

  const containerClassName = css`
    height: 100%;
    max-width: 100%;
    transition: opacity ${theme.animation.normal} ${theme.animation.resistance};
    overflow: auto;
  `;

  return (
    <EuiPanel hasBorder hasShadow={false} className={panelClassName} paddingSize="none">
      <EuiFlexGroup
        direction="column"
        gutterSize="none"
        className={containerClassName}
        alignItems="stretch"
      >
        <EuiFlexItem grow={false}>
          <EuiFlexGroup
            direction="row"
            gutterSize="none"
            alignItems="center"
            className={headerClassName}
          >
            <EuiFlexItem className={titleContainerClassName}>
              <EuiText size="s" className={titleItemClassName}>
                <h5>{title}</h5>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false} className="gridItemControls">
              <EuiFlexGroup
                direction="row"
                gutterSize="none"
                alignItems="center"
                justifyContent="flexEnd"
              >
                <EuiFlexItem grow={false}>
                  <InvestigateTextButton
                    iconType="copy"
                    onClick={() => {
                      onCopy();
                    }}
                    disabled={loading}
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <InvestigateTextButton
                    iconType="trash"
                    onClick={() => {
                      onDelete();
                    }}
                    disabled={loading}
                  />
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem className={panelContentClassName}>{children}</EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
}
