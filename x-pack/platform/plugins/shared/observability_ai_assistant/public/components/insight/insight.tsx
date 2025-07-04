/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import {
  EuiHorizontalRule,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
  EuiTextArea,
  EuiCallOut,
  EuiLoadingSpinner,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { cloneDeep, isArray, isEmpty, last, once } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useObservable from 'react-use/lib/useObservable';
import { ILicense } from '@kbn/licensing-plugin/public';
import { MessageRole, type Message } from '../../../common/types';
import { ObservabilityAIAssistantChatServiceContext } from '../../context/observability_ai_assistant_chat_service_context';
import { useAbortableAsync } from '../../hooks/use_abortable_async';
import { ChatState, useChat } from '../../hooks/use_chat';
import { useGenAIConnectors } from '../../hooks/use_genai_connectors';
import { useKibana } from '../../hooks/use_kibana';
import { useObservabilityAIAssistant } from '../../hooks/use_observability_ai_assistant';
import { useObservabilityAIAssistantChatService } from '../../hooks/use_observability_ai_assistant_chat_service';
import { useFlyoutState } from '../../hooks/use_flyout_state';
import { getConnectorsManagementHref } from '../../utils/navigate_to_connectors';
import { RegenerateResponseButton } from '../buttons/regenerate_response_button';
import { StartChatButton } from '../buttons/start_chat_button';
import { StopGeneratingButton } from '../buttons/stop_generating_button';
import { FeedbackButtons } from '../buttons/feedback_buttons';
import { MessagePanel } from '../message_panel/message_panel';
import { MessageText } from '../message_panel/message_text';
import { MissingCredentialsCallout } from '../missing_credentials_callout';
import { InsightBase } from './insight_base';
import { ActionsMenu } from './actions_menu';
import { ObservabilityAIAssistantTelemetryEventType } from '../../analytics/telemetry_event_type';
import { getElasticManagedLlmConnector } from '../../utils/get_elastic_managed_llm_connector';
import { ElasticLlmTourCallout } from '../tour_callout/elastic_llm_tour_callout';
import {
  ElasticLlmCalloutKey,
  useElasticLlmCalloutDismissed,
} from '../../hooks/use_elastic_llm_callout_dismissed';

function getLastMessageOfType(messages: Message[], role: MessageRole) {
  return last(messages.filter((msg) => msg.message.role === role));
}

function ChatContent({
  title: defaultTitle,
  initialMessages,
  connectorId,
  setIsTourCalloutOpen,
}: {
  title: string;
  initialMessages: Message[];
  connectorId: string;
  setIsTourCalloutOpen: (isOpen: boolean) => void;
}) {
  const service = useObservabilityAIAssistant();
  const chatService = useObservabilityAIAssistantChatService();
  const scopes = chatService.getScopes();

  const initialMessagesRef = useRef(initialMessages);

  const { flyoutState } = useFlyoutState();

  const { messages, next, state, stop } = useChat({
    service,
    chatService,
    connectorId,
    initialMessages,
    persist: false,
    disableFunctions: true,
    scopes,
  });

  const lastAssistantResponse = getLastMessageOfType(
    messages.slice(initialMessagesRef.current.length + 1),
    MessageRole.Assistant
  );

  useEffect(() => {
    next(initialMessagesRef.current);
  }, [next]);

  useEffect(() => {
    if (state !== ChatState.Loading && lastAssistantResponse) {
      chatService.sendAnalyticsEvent({
        type: ObservabilityAIAssistantTelemetryEventType.InsightResponse,
        payload: {
          '@timestamp': lastAssistantResponse['@timestamp'],
        },
      });
    }
  }, [state, lastAssistantResponse, chatService]);

  return (
    <>
      <MessagePanel
        body={
          <MessageText
            content={lastAssistantResponse?.message.content ?? ''}
            loading={state === ChatState.Loading}
            onActionClick={async () => {}}
          />
        }
        error={state === ChatState.Error}
        controls={
          state === ChatState.Loading ? (
            <StopGeneratingButton
              onClick={() => {
                stop();
              }}
            />
          ) : (
            <EuiFlexGroup direction="row">
              <FeedbackButtons
                onClickFeedback={(feedback) => {
                  if (lastAssistantResponse) {
                    chatService.sendAnalyticsEvent({
                      type: ObservabilityAIAssistantTelemetryEventType.InsightFeedback,
                      payload: {
                        feedback,
                      },
                    });
                  }
                }}
              />
              <EuiFlexItem grow={false}>
                <RegenerateResponseButton
                  onClick={() => {
                    next(initialMessages);
                  }}
                />
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <StartChatButton
                  disabled={flyoutState.isOpen}
                  onClick={() => {
                    setIsTourCalloutOpen(false);
                    service.conversations.openNewConversation({
                      messages,
                      title: defaultTitle,
                      hideConversationList: true,
                    });
                  }}
                />
              </EuiFlexItem>
            </EuiFlexGroup>
          )
        }
      />
    </>
  );
}

function PromptEdit({
  initialPrompt,
  onSend,
  onCancel,
}: {
  initialPrompt: string;
  onSend: (updatedPrompt: string) => void;
  onCancel: () => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);

  return (
    <EuiFlexGroup alignItems={'center'}>
      <EuiFlexItem grow={true}>
        <EuiTextArea
          data-test-subj="observabilityAiAssistantInsightEditPromptTextArea"
          inputRef={(textarea) => {
            if (textarea) {
              setTimeout(() => textarea.focus());
            }
          }}
          fullWidth={true}
          defaultValue={prompt}
          onChange={(ev) => {
            setPrompt(ev.target.value);
          }}
        />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiButtonIcon
          aria-label={i18n.translate('xpack.observabilityAiAssistant.insight.cancelPromptEdit', {
            defaultMessage: 'Cancel',
          })}
          data-test-subj="observabilityAiAssistantInsightCancelEditPromptButtonIcon"
          iconType="cross"
          display="base"
          color="danger"
          size="m"
          onClick={onCancel}
        />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiButtonIcon
          aria-label={i18n.translate('xpack.observabilityAiAssistant.insight.sendPromptEdit', {
            defaultMessage: 'Send prompt',
          })}
          data-test-subj="observabilityAiAssistantInsightSendEditPromptButtonIcon"
          iconType="kqlFunction"
          display="fill"
          size="m"
          onClick={() => onSend(prompt)}
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}

export interface InsightProps {
  messages: Message[] | (() => Promise<Message[] | undefined>);
  title: string;
  dataTestSubj?: string;
  showElasticLlmCallout?: boolean;
}

enum FETCH_STATUS {
  LOADING = 'loading',
  SUCCESS = 'success',
  FAILURE = 'failure',
  NOT_INITIATED = 'not_initiated',
}

export function Insight({
  messages: initialMessagesOrCallback,
  title,
  dataTestSubj,
  showElasticLlmCallout = true,
}: InsightProps) {
  const [messages, setMessages] = useState<{ messages: Message[]; status: FETCH_STATUS }>({
    messages: [],
    status: FETCH_STATUS.NOT_INITIATED,
  });
  const [isEditingPrompt, setEditingPrompt] = useState(false);
  const [isInsightOpen, setInsightOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [isPromptUpdated, setIsPromptUpdated] = useState(false);
  const [isTourCalloutOpen, setIsTourCalloutOpen] = useState(true);
  const [tourCalloutDismissed, setTourCalloutDismissed] = useElasticLlmCalloutDismissed(
    ElasticLlmCalloutKey.TOUR_CALLOUT,
    false
  );

  const updateInitialMessages = useCallback(async () => {
    if (isArray(initialMessagesOrCallback)) {
      setMessages({
        messages: initialMessagesOrCallback,
        status: FETCH_STATUS.SUCCESS,
      });
      return;
    }

    setMessages({
      messages: [],
      status: FETCH_STATUS.LOADING,
    });

    try {
      const data = await initialMessagesOrCallback();
      setMessages({
        messages: data ?? [],
        status: FETCH_STATUS.SUCCESS,
      });
    } catch (e) {
      setMessages({
        messages: [],
        status: FETCH_STATUS.FAILURE,
      });

      // eslint-disable-next-line no-console
      console.log('could not load insight messages', e);
    }
  }, [initialMessagesOrCallback]);

  const updateInitialMessagesOnce = useMemo(
    () => once(updateInitialMessages),
    [updateInitialMessages]
  );

  useEffect(() => {
    if (isInsightOpen) {
      updateInitialMessagesOnce();
    }
  }, [updateInitialMessagesOnce, isInsightOpen]);

  const connectors = useGenAIConnectors();
  const service = useObservabilityAIAssistant();

  const chatService = useAbortableAsync(
    ({ signal }) => {
      return service.start({ signal });
    },
    [service]
  );

  const getPromptToEdit = () => {
    const clonedMessages = cloneDeep(messages.messages);
    const lastUserPrompt = getLastMessageOfType(clonedMessages, MessageRole.User)?.message.content;

    if (!lastUserPrompt) {
      return '';
    }

    try {
      const { instructions = '' } = JSON.parse(lastUserPrompt);
      return instructions.trim();
    } catch (e) {
      return '';
    }
  };

  const onEditPrompt = (newPrompt: string) => {
    const clonedMessages = cloneDeep(messages.messages);
    const userMessage = getLastMessageOfType(clonedMessages, MessageRole.User);
    if (!userMessage) return false;

    try {
      const parsedContent = JSON.parse(userMessage.message.content || '');

      if (!parsedContent.instructions) {
        return false;
      }

      // Assign the updated instructions
      parsedContent.instructions = newPrompt;
      userMessage.message.content = JSON.stringify(parsedContent);

      setIsPromptUpdated(true);
      setMessages({ messages: clonedMessages, status: FETCH_STATUS.SUCCESS });
      setEditingPrompt(false);
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to edit prompt:', e);
      return false;
    }
  };

  const handleCancel = () => {
    setEditingPrompt(false);
    setInsightOpen(false);
    setHasOpened(false);
  };

  const {
    services: {
      http,
      plugins: {
        start: { licensing },
      },
    },
  } = useKibana();

  const license = useObservable<ILicense | null>(licensing.license$);
  const hasEnterpriseLicense = license?.hasAtLeast('enterprise');
  if (isEmpty(connectors.connectors) || !hasEnterpriseLicense) {
    return null;
  }

  let children: React.ReactNode = null;

  if (
    connectors.selectedConnector &&
    ((!isInsightOpen && hasOpened) ||
      (isInsightOpen && !isEditingPrompt && messages.status === FETCH_STATUS.SUCCESS))
  ) {
    children = (
      <>
        {isPromptUpdated ? (
          <>
            <EuiFlexGroup alignItems="center" gutterSize="none">
              <EuiFlexItem grow={false}>
                <EuiText size="xs">
                  {i18n.translate('xpack.observabilityAiAssistant.insightModifiedPrompt', {
                    defaultMessage: 'This insight has been modified.',
                  })}
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  data-test-subj="observabilityAiAssistantInsightResetDefaultPrompt"
                  onClick={() => {
                    setIsPromptUpdated(false);
                    setHasOpened(false);
                    setInsightOpen(false);
                    updateInitialMessages();
                  }}
                >
                  <EuiText size="xs">
                    {i18n.translate('xpack.observabilityAiAssistant.resetDefaultPrompt', {
                      defaultMessage: 'Reset to default',
                    })}
                  </EuiText>
                </EuiButtonEmpty>
              </EuiFlexItem>
            </EuiFlexGroup>

            <EuiHorizontalRule size="full" margin="none" />
            <EuiSpacer size="m" />
          </>
        ) : null}

        <ChatContent
          title={title}
          initialMessages={messages.messages}
          connectorId={connectors.selectedConnector}
          setIsTourCalloutOpen={setIsTourCalloutOpen}
        />
      </>
    );
  } else if (isEditingPrompt) {
    const promptToEdit = getPromptToEdit();

    if (messages.status === FETCH_STATUS.SUCCESS && promptToEdit) {
      children = (
        <PromptEdit initialPrompt={promptToEdit} onSend={onEditPrompt} onCancel={handleCancel} />
      );
    } else {
      children = <EuiLoadingSpinner size="m" />;
    }
  } else if (!connectors.loading && !connectors.connectors?.length) {
    children = (
      <MissingCredentialsCallout connectorsManagementHref={getConnectorsManagementHref(http!)} />
    );
  } else if (messages.status === FETCH_STATUS.FAILURE) {
    children = (
      <EuiCallOut
        size="s"
        title={i18n.translate(
          'xpack.observabilityAiAssistant.insight.div.errorFetchingMessagesLabel',
          {
            defaultMessage: 'Could not fetch prompt messages',
          }
        )}
        color="danger"
        iconType="error"
      />
    );
  }

  const elasticManagedLlm = getElasticManagedLlmConnector(connectors.connectors);

  return (
    <InsightBase
      title={title}
      onToggle={(isOpen) => {
        setHasOpened((prevHasOpened) => {
          if (isEditingPrompt) return false;
          return prevHasOpened || isOpen;
        });
        setInsightOpen(isOpen);
      }}
      controls={
        !!elasticManagedLlm && showElasticLlmCallout ? (
          <ElasticLlmTourCallout
            isOpen={!tourCalloutDismissed && isTourCalloutOpen}
            zIndex={999}
            dismissTour={() => setTourCalloutDismissed(true)}
          >
            <ActionsMenu
              connectors={connectors}
              onEditPrompt={() => {
                setEditingPrompt(true);
                setInsightOpen(true);
              }}
            />
          </ElasticLlmTourCallout>
        ) : (
          <ActionsMenu
            connectors={connectors}
            onEditPrompt={() => {
              setEditingPrompt(true);
              setInsightOpen(true);
            }}
          />
        )
      }
      loading={connectors.loading || chatService.loading}
      dataTestSubj={dataTestSubj}
      isOpen={isInsightOpen}
    >
      {chatService.value ? (
        <ObservabilityAIAssistantChatServiceContext.Provider value={chatService.value}>
          {children}
        </ObservabilityAIAssistantChatServiceContext.Provider>
      ) : null}
    </InsightBase>
  );
}
