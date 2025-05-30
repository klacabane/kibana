/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FC } from 'react';
import React, { useState, useContext, useEffect } from 'react';
import { EuiFieldText, useGeneratedHtmlId } from '@elastic/eui';
import { JobCreatorContext } from '../../../job_creator_context';
import { Description } from './description';
import { calculateDatafeedFrequencyDefaultSeconds } from '../../../../../../../../../common/util/job_utils';
import { useStringifiedValue } from '../hooks';

export const FrequencyInput: FC = () => {
  const { jobCreator, jobCreatorUpdate, jobCreatorUpdated, jobValidator, jobValidatorUpdated } =
    useContext(JobCreatorContext);
  const [validation, setValidation] = useState(jobValidator.frequency);
  const { value: frequency, setValue: setFrequency } = useStringifiedValue(jobCreator.frequency);

  const [defaultFrequency, setDefaultFrequency] = useState(createDefaultFrequency());
  const titleId = useGeneratedHtmlId({
    prefix: 'frequencyInput',
  });
  useEffect(() => {
    jobCreator.frequency = frequency === '' ? null : frequency;
    jobCreatorUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequency]);

  useEffect(() => {
    setFrequency(jobCreator.frequency);

    const df = createDefaultFrequency();
    setDefaultFrequency(df);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobCreatorUpdated]);

  useEffect(() => {
    setValidation(jobValidator.frequency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobValidatorUpdated]);

  function createDefaultFrequency() {
    const df = calculateDatafeedFrequencyDefaultSeconds(jobCreator.bucketSpanMs / 1000);
    return `${df}s`;
  }

  return (
    <Description validation={validation} titleId={titleId}>
      <EuiFieldText
        value={frequency}
        placeholder={defaultFrequency}
        onChange={(e) => setFrequency(e.target.value)}
        isInvalid={validation.valid === false}
        data-test-subj="mlJobWizardInputFrequency"
        aria-labelledby={titleId}
      />
    </Description>
  );
};
