import {observer} from "mobx-react-lite";

import {useTabState} from "../../state";
import {
  AuthAdminState,
  DraftSMTPConfig,
  EmailProviderConfig,
  smtpSecurity,
  SMTPSecurity,
} from "./state";

import cn from "@edgedb/common/utils/classNames";

import {
  Button,
  Checkbox,
  ChevronDownIcon,
  ConfirmButton,
  FieldHeader,
  Select,
  TextInput,
  WarningIcon,
} from "@edgedb/common/newui";
import {LoadingSkeleton} from "@edgedb/common/newui/loadingSkeleton";

import styles from "./authAdmin.module.scss";
import {InputSkeleton, StickyFormControls} from "./shared";
import Spinner from "@edgedb/common/ui/spinner";
import {useState} from "react";

export const SMTPConfigTab = observer(function SMTPConfigTab() {
  const state = useTabState(AuthAdminState);

  let content: JSX.Element | null = null;
  if (state.newSMTPSchema) {
    const newDraftState = state.draftSMTPConfigs.get("");

    content = state.emailProviders ? (
      <>
        {state.emailProviders.length ? (
          <>
            {state.noEmailProviderWarning ? (
              <div className={styles.emailProviderWarning}>
                <WarningIcon />
                <span>Warning:</span> None of the configured SMTP providers
                have been selected. Select a provider below to enable email
                sending (eg. email verification, password reset emails, etc.)
                in the auth extension.
              </div>
            ) : null}

            <div
              className={cn(styles.cardList, {
                [styles.emailProvidersUpdating]: state.updatingEmailProviders,
              })}
            >
              {state.emailProviders.map((provider) => (
                <EmailProviderCard
                  key={provider.name}
                  state={state}
                  provider={provider}
                />
              ))}
            </div>
          </>
        ) : null}

        {newDraftState ? (
          <div className={styles.addDraft}>
            <NewDraftSMTPProviderForm
              state={state}
              draftState={newDraftState}
            />
          </div>
        ) : (
          <div className={styles.addDraft}>
            <Button onClick={() => state.addDraftSMTPProvider()}>
              Add SMTP Provider
            </Button>
          </div>
        )}
      </>
    ) : (
      <div className={styles.cardList}>
        <LoadingSkeleton className={styles.emailProviderSkeleton} />
        <LoadingSkeleton className={styles.emailProviderSkeleton} />
      </div>
    );
  } else {
    const draftState = state.draftSMTPConfigs.get("");

    content = draftState ? (
      <>
        <SMTPConfigForm
          loaded={draftState?.currentConfig != null}
          smtp={draftState}
        />

        <StickyFormControls draft={draftState} />
      </>
    ) : null;
  }

  return (
    <div className={styles.tabContentWrapper}>
      <h2>SMTP Configuration</h2>

      {content}
    </div>
  );
});

const EmailProviderCard = observer(function EmailProviderCard({
  state,
  provider,
}: {
  state: AuthAdminState;
  provider: EmailProviderConfig;
}) {
  const [updating, setUpdating] = useState(false);

  const isSelectedProvider = state.currentEmailProvider === provider.name;
  const draftState = state.draftSMTPConfigs.get(provider.name);

  return (
    <div className={cn(styles.card, styles.emailProviderCard)}>
      <div className={styles.cardMain}>
        {updating ? (
          <Spinner
            className={styles.updatingSpinner}
            size={18.5}
            strokeWidth={1.5}
          />
        ) : (
          <svg
            className={cn(styles.selectCurrentProvider, {
              [styles.selected]: isSelectedProvider,
            })}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="-6 -6 32 32"
            fill="none"
            onClick={() => {
              setUpdating(true);
              state
                .setCurrentEmailProvider(provider.name)
                .finally(() => setUpdating(false));
            }}
          >
            <circle cx="10" cy="10" r="9.5" />
            {isSelectedProvider ? (
              <path
                d="M14.6226 7.0503L8.43506 13.2378L5.62256 10.4253"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </svg>
        )}
        <div className={styles.details}>
          <div className={styles.name}>{provider.name}</div>
          {provider._typename === "cfg::SMTPProviderConfig" ? (
            <div className={styles.senderhost}>
              {provider.sender} <span>•</span> {provider.host || "localhost"}:
              {provider.port ||
                (provider.security === "PlainText"
                  ? "25"
                  : provider.security === "TLS"
                  ? "465"
                  : provider.security === "STARTTLS"
                  ? "587"
                  : "587/25")}
            </div>
          ) : null}
        </div>
        <div
          className={cn(styles.expandButton, {
            [styles.expanded]: draftState?.expanded ?? false,
          })}
          onClick={() =>
            draftState
              ? draftState.toggleExpanded()
              : state.addDraftSMTPProvider(provider)
          }
        >
          <ChevronDownIcon />
        </div>
      </div>

      {draftState?.expanded ? (
        <>
          <div className={styles.expandedEmailProviderConfig}>
            <SMTPConfigForm loaded hasName smtp={draftState} />
          </div>

          <div className={styles.buttons}>
            <ConfirmButton
              style={{marginRight: "auto"}}
              onClick={() => state.removeEmailProvider(provider.name)}
            >
              Remove
            </ConfirmButton>

            {draftState.formChanged ? (
              <Button
                disabled={draftState.updating}
                onClick={() => draftState.clearForm()}
              >
                Clear changes
              </Button>
            ) : null}
            <Button
              kind="primary"
              onClick={() => draftState.update()}
              disabled={draftState.formError || !draftState.formChanged}
              loading={draftState.updating}
            >
              {draftState.updating ? "Updating..." : "Update"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
});

const NewDraftSMTPProviderForm = observer(function NewDraftSMTPProviderForm({
  state,
  draftState,
}: {
  state: AuthAdminState;
  draftState: DraftSMTPConfig;
}) {
  return (
    <div className={styles.newDraftSMTPProvider}>
      <SMTPConfigForm loaded hasName newProvider smtp={draftState} />

      <div className={styles.buttons}>
        <Button
          disabled={draftState.updating}
          onClick={() => state.cancelDraftSMTPProvider()}
        >
          Cancel
        </Button>
        <Button
          kind="primary"
          onClick={() => draftState.update()}
          disabled={draftState.formError || !draftState.formChanged}
          loading={draftState.updating}
        >
          {draftState.updating
            ? "Adding SMTP Provider..."
            : "Add SMTP Provider"}
        </Button>
      </div>
    </div>
  );
});

const SMTPConfigForm = observer(function SMTPConfigForm({
  hasName,
  newProvider,
  loaded,
  smtp,
}: {
  hasName?: boolean;
  newProvider?: boolean;
  loaded: boolean;
  smtp: DraftSMTPConfig;
}) {
  const security = smtp.getConfigValue("security") as unknown as SMTPSecurity;

  return (
    <div className={styles.configGrid}>
      {hasName ? (
        <div className={styles.gridItem}>
          <div className={styles.configName}>
            <FieldHeader label="Provider name" />
          </div>

          <div className={cn(styles.configInput, styles.fullWidth)}>
            {loaded ? (
              <TextInput
                value={smtp.getConfigValue("name")}
                onChange={(e) => smtp.setConfigValue("name", e.target.value)}
                error={smtp.nameError}
              />
            ) : (
              <InputSkeleton />
            )}
          </div>
          <div className={styles.configExplain}>
            The name of the email provider. Must be unique.
          </div>
        </div>
      ) : null}

      <div className={styles.gridItem}>
        <div className={styles.configName}>
          <FieldHeader label="Sender" />
        </div>

        <div className={cn(styles.configInput, styles.fullWidth)}>
          {loaded ? (
            <TextInput
              value={smtp.getConfigValue("sender")}
              onChange={(e) => smtp.setConfigValue("sender", e.target.value)}
              error={smtp.senderError}
            />
          ) : (
            <InputSkeleton />
          )}
        </div>
        <div className={styles.configExplain}>
          "From" address of system emails sent for e.g. password reset, etc.
        </div>
      </div>

      <div className={styles.gridItem}>
        <div className={styles.configName}>
          <FieldHeader label="Host" />
        </div>

        <div className={cn(styles.configInput, styles.fullWidth)}>
          {loaded ? (
            <TextInput
              value={smtp.getConfigValue("host")}
              onChange={(e) => smtp.setConfigValue("host", e.target.value)}
              placeholder="localhost"
            />
          ) : (
            <InputSkeleton />
          )}
        </div>
        <div className={styles.configExplain}>
          Host of SMTP server to use for sending emails. If not set,
          "localhost" will be used.
        </div>
      </div>

      <div className={styles.gridItem}>
        <div className={styles.configName}>
          <FieldHeader label="Port" />
        </div>

        <div className={styles.configInput}>
          {loaded ? (
            <TextInput
              value={smtp.getConfigValue("port")}
              onChange={(e) => smtp.setConfigValue("port", e.target.value)}
              placeholder={
                security === "STARTTLSOrPlainText"
                  ? "587 or 25"
                  : security === "TLS"
                  ? "465"
                  : security === "STARTTLS"
                  ? "587"
                  : "25"
              }
              error={smtp.portError}
              size={10}
            />
          ) : (
            <InputSkeleton />
          )}
        </div>
        <div className={styles.configExplain}>
          Port of SMTP server to use for sending emails. If not set, common
          defaults will be used depending on security: 465 for TLS, 587 for
          STARTTLS, 25 otherwise.
        </div>
      </div>

      <div className={styles.gridItem}>
        <div className={styles.configName}>
          <FieldHeader label="Username" />
        </div>

        <div className={cn(styles.configInput, styles.fullWidth)}>
          {loaded ? (
            <TextInput
              value={smtp.getConfigValue("username")}
              onChange={(e) => smtp.setConfigValue("username", e.target.value)}
            />
          ) : (
            <InputSkeleton />
          )}
        </div>
        <div className={styles.configExplain}>
          Username to login as after connected to SMTP server.
        </div>
      </div>

      <div className={styles.gridItem}>
        <div className={styles.configName}>
          <FieldHeader label={newProvider ? "Password" : "New password"} />
        </div>

        <div className={cn(styles.configInput, styles.fullWidth)}>
          {loaded ? (
            <TextInput
              value={smtp.getConfigValue("password")}
              onChange={(e) => smtp.setConfigValue("password", e.target.value)}
            />
          ) : (
            <InputSkeleton />
          )}
        </div>
        <div className={styles.configExplain}>
          Password for login after connected to SMTP server.{" "}
          {!newProvider
            ? "Note: will replace the currently configured SMTP password."
            : null}
        </div>
      </div>

      <div className={styles.gridItem}>
        <div className={styles.configName}>
          <FieldHeader label="Security" />
        </div>

        <div className={styles.configInput}>
          {loaded ? (
            <Select<SMTPSecurity>
              className={styles.securitySelect}
              selectedItemId={smtp.getConfigValue("security") as any}
              onChange={(item) => smtp.setConfigValue("security", item.id)}
              items={smtpSecurity.map((val) => ({id: val, label: val}))}
            />
          ) : (
            <InputSkeleton />
          )}
        </div>
        <div className={styles.configExplain}>
          Security mode of the connection to SMTP server. By default, initiate
          a STARTTLS upgrade if supported by the server, or fallback to
          PlainText.
        </div>
      </div>

      <div className={styles.gridItem}>
        <div className={styles.configName}>
          <FieldHeader label="Validate certs" />
        </div>

        <div className={styles.configInput}>
          {loaded ? (
            <Checkbox
              checked={
                smtp._validate_certs ??
                smtp.currentConfig?.validate_certs ??
                true
              }
              onChange={(checked) =>
                smtp.setConfigValue("validate_certs", checked)
              }
            />
          ) : (
            <InputSkeleton />
          )}
        </div>
        <div className={styles.configExplain}>
          Determines if SMTP server certificates are validated.
        </div>
      </div>

      <div className={styles.gridItem}>
        <div className={styles.configName}>
          <FieldHeader label="Timeout per email" />
        </div>

        <div className={styles.configInput}>
          {loaded ? (
            <TextInput
              value={smtp.getConfigValue("timeout_per_email")}
              onChange={(e) =>
                smtp.setConfigValue(
                  "timeout_per_email",
                  e.target.value.toUpperCase()
                )
              }
              error={smtp.timeoutPerEmailError}
            />
          ) : (
            <InputSkeleton />
          )}
        </div>
        <div className={styles.configExplain}>
          Maximum time in seconds to send an email, including retry attempts.
        </div>
      </div>

      <div className={styles.gridItem}>
        <div className={styles.configName}>
          <FieldHeader label="Timeout per attempt" />
        </div>

        <div className={styles.configInput}>
          {loaded ? (
            <TextInput
              value={smtp.getConfigValue("timeout_per_attempt")}
              onChange={(e) =>
                smtp.setConfigValue(
                  "timeout_per_attempt",
                  e.target.value.toUpperCase()
                )
              }
              error={smtp.timeoutPerAttemptError}
            />
          ) : (
            <InputSkeleton />
          )}
        </div>
        <div className={styles.configExplain}>
          Maximum time in seconds for each SMTP request.
        </div>
      </div>
    </div>
  );
});
