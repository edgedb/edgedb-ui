import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";
import {
  Button,
  Checkbox,
  ChevronDownIcon,
  ConfirmButton,
  FieldHeader,
  InfoTooltip,
  TextInput,
} from "@edgedb/common/newui";

import {useTabState} from "../../state";
import {
  AuthAdminState,
  DraftWebhookConfig,
  WebhookConfigData,
  webhookEvents,
} from "./state";

import styles from "./authAdmin.module.scss";
import {useState} from "react";
import {LoadingSkeleton} from "@edgedb/common/newui/loadingSkeleton";

export const WebhooksTab = observer(function WebhooksTab() {
  const state = useTabState(AuthAdminState);

  return (
    <div className={styles.tabContentWrapper}>
      <h2>Webhooks</h2>
      {state.webhooks ? (
        <>
          {state.webhooks.length ? (
            <div className={styles.cardList}>
              {state.webhooks.map((webhook) => (
                <WebhookConfigCard key={webhook.url} config={webhook} />
              ))}
            </div>
          ) : null}

          <div className={styles.addDraft}>
            {state.draftWebhookConfig ? (
              <WebhookDraftForm draft={state.draftWebhookConfig} />
            ) : (
              <Button onClick={() => state.addDraftWebhook()}>
                Add Webhook
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className={styles.cardList}>
          <LoadingSkeleton className={styles.webhookSkeleton} />
          <LoadingSkeleton className={styles.webhookSkeleton} />
          <LoadingSkeleton className={styles.webhookSkeleton} />
        </div>
      )}
    </div>
  );
});

function WebhookConfigCard({config}: {config: WebhookConfigData}) {
  const state = useTabState(AuthAdminState);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(styles.card, styles.webhookConfigCard, {
        [styles.expanded]: expanded,
      })}
    >
      <div className={styles.cardMain}>
        <div className={styles.details}>
          <div className={styles.url}>{config.url}</div>
          <div className={styles.events}>
            {config.events.map((event) => (
              <span key={event}>{event}</span>
            ))}
          </div>
        </div>
        <div
          className={cn(styles.expandButton, {[styles.expanded]: expanded})}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDownIcon />
        </div>
      </div>
      {expanded ? (
        <div className={styles.expandedConfig}>
          <div className={cn(styles.formRow, styles.fullWidth)}>
            <TextInput readOnly label={"Webhook URL"} value={config.url} />
            <TextInput
              readOnly
              label={"Signing secret key"}
              value={config.signing_secret_key_exists ? "secret hidden" : ""}
              type="password"
            />
          </div>
          <div className={styles.webhookEvents}>
            <FieldHeader label="Events" />
            <div
              className={styles.grid}
              style={{"--itemCount": webhookEvents.length} as any}
            >
              {webhookEvents.map((event) => (
                <Checkbox
                  readOnly
                  key={event}
                  label={event}
                  checked={config.events.includes(event)}
                />
              ))}
            </div>
          </div>

          <div className={cn(styles.formRow, styles.buttons)}>
            <ConfirmButton onClick={() => state.removeWebhook(config.url)}>
              Remove
            </ConfirmButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const WebhookDraftForm = observer(function WebhookDraftForm({
  draft,
}: {
  draft: DraftWebhookConfig;
}) {
  const state = useTabState(AuthAdminState);

  return (
    <div className={cn(styles.draftForm, styles.draftWebhookForm)}>
      <div className={cn(styles.formRow, styles.evenWidth)}>
        <TextInput
          label="Webhook URL"
          value={draft.url ?? ""}
          onChange={(e) => draft.setUrl(e.target.value)}
          error={draft.urlError}
        />{" "}
        <TextInput
          label={
            <>
              Signing secret key{" "}
              <InfoTooltip message="The secret key used to sign webhook requests" />
            </>
          }
          optional
          value={draft.signing_key ?? ""}
          onChange={(e) => draft.setSigning_key(e.target.value)}
        />
      </div>

      <div className={styles.webhookEvents}>
        <FieldHeader
          label="Events"
          headerNote="At least one event must be selected"
        />
        <div
          className={styles.grid}
          style={{"--itemCount": webhookEvents.length} as any}
        >
          {webhookEvents.map((event) => (
            <Checkbox
              key={event}
              label={event}
              checked={draft.events.has(event)}
              onChange={(checked) => {
                if (checked) {
                  draft.events.add(event);
                } else {
                  draft.events.delete(event);
                }
              }}
            />
          ))}
        </div>
      </div>

      <div className={cn(styles.formRow, styles.buttons)}>
        <Button onClick={() => state.cancelDraftWebhook()}>Cancel</Button>
        <Button
          kind="primary"
          onClick={() => draft.addWebhook()}
          disabled={!draft.formValid}
          loading={draft.updating}
        >
          {draft.updating ? "Adding Webhook..." : "Add Webhook"}
        </Button>
      </div>
    </div>
  );
});