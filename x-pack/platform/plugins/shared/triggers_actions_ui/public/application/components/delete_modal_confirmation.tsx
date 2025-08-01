/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { EuiCallOut, EuiConfirmModal, useGeneratedHtmlId } from '@elastic/eui';
import React, { useEffect, useState } from 'react';
import { HttpSetup } from '@kbn/core/public';
import { useKibana } from '../../common/lib/kibana';
import {
  getSuccessfulDeletionNotificationText,
  getFailedDeletionNotificationText,
  getConfirmDeletionButtonText,
  getConfirmDeletionModalText,
  CANCEL_BUTTON_TEXT,
} from '../sections/rules_list/translations';

export const DeleteModalConfirmation = ({
  idsToDelete,
  apiDeleteCall,
  onDeleted,
  onCancel,
  onErrors,
  singleTitle,
  multipleTitle,
  showWarningText,
  warningText,
  setIsLoadingState,
}: {
  idsToDelete: string[];
  apiDeleteCall: ({
    ids,
    http,
  }: {
    ids: string[];
    http: HttpSetup;
  }) => Promise<{ successes: string[]; errors: string[] }>;
  onDeleted: (deleted: string[]) => void;
  onCancel: () => void;
  onErrors: () => void;
  singleTitle: string;
  multipleTitle: string;
  setIsLoadingState: (isLoading: boolean) => void;
  showWarningText?: boolean;
  warningText?: string;
}) => {
  const [deleteModalFlyoutVisible, setDeleteModalVisibility] = useState<boolean>(false);

  useEffect(() => {
    setDeleteModalVisibility(idsToDelete.length > 0);
  }, [idsToDelete]);

  const {
    http,
    notifications: { toasts },
  } = useKibana().services;
  const modalTitleId = useGeneratedHtmlId();

  const numIdsToDelete = idsToDelete.length;
  if (!deleteModalFlyoutVisible) {
    return null;
  }

  return (
    <EuiConfirmModal
      aria-labelledby={modalTitleId}
      buttonColor="danger"
      data-test-subj="deleteIdsConfirmation"
      title={getConfirmDeletionButtonText(numIdsToDelete, singleTitle, multipleTitle)}
      titleProps={{ id: modalTitleId }}
      onCancel={() => {
        setDeleteModalVisibility(false);
        onCancel();
      }}
      onConfirm={async () => {
        setDeleteModalVisibility(false);
        setIsLoadingState(true);
        const { successes, errors } = await apiDeleteCall({ ids: idsToDelete, http });
        setIsLoadingState(false);

        const numSuccesses = successes.length;
        const numErrors = errors.length;

        if (numErrors > 0) {
          toasts.addDanger(
            getFailedDeletionNotificationText(numErrors, singleTitle, multipleTitle)
          );
          await onErrors();
        }

        if (numSuccesses > 0) {
          toasts.addSuccess(
            getSuccessfulDeletionNotificationText(numSuccesses, singleTitle, multipleTitle)
          );
          await onDeleted(successes);
        }
      }}
      cancelButtonText={CANCEL_BUTTON_TEXT}
      confirmButtonText={getConfirmDeletionButtonText(numIdsToDelete, singleTitle, multipleTitle)}
    >
      <p>{getConfirmDeletionModalText(numIdsToDelete, singleTitle, multipleTitle)}</p>
      {showWarningText && (
        <EuiCallOut title={<>{warningText}</>} color="warning" iconType="warning" />
      )}
    </EuiConfirmModal>
  );
};
