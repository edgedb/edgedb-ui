import {observer} from "mobx-react-lite";

import {useTabState} from "../../state";
import {AuthAdminState, smtpSecurity, SMTPSecurity} from "./state";

import cn from "@edgedb/common/utils/classNames";

import {Checkbox, FieldHeader, Select, TextInput} from "@edgedb/common/newui";

import styles from "./authAdmin.module.scss";
import {InputSkeleton, StickyFormControls} from "./shared";

export const SMTPConfigTab = observer(function SMTPConfigTab() {
  const state = useTabState(AuthAdminState);

  const loaded = state.smtpConfig != null;

  const smtp = state.draftSMTPConfig;

  const security = smtp.getConfigValue("security") as unknown as SMTPSecurity;

  return (
    <div className={styles.tabContentWrapper}>
      <h2>SMTP Configuration</h2>

      <div className={styles.configGrid}>
        <div className={styles.gridItem}>
          <div className={styles.configName}>
            <FieldHeader label="Sender" />
          </div>

          <div className={cn(styles.configInput, styles.fullWidth)}>
            {loaded ? (
              <TextInput
                value={smtp.getConfigValue("sender")}
                onChange={(e) => smtp.setConfigValue("sender", e.target.value)}
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
                onChange={(e) =>
                  smtp.setConfigValue("username", e.target.value)
                }
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
            <FieldHeader label="New password" />
          </div>

          <div className={cn(styles.configInput, styles.fullWidth)}>
            {loaded ? (
              <TextInput
                value={smtp.getConfigValue("password")}
                onChange={(e) =>
                  smtp.setConfigValue("password", e.target.value)
                }
              />
            ) : (
              <InputSkeleton />
            )}
          </div>
          <div className={styles.configExplain}>
            Password for login after connected to SMTP server. Note: will
            replace the currently configured SMTP password (if set).
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
            Security mode of the connection to SMTP server. By default,
            initiate a STARTTLS upgrade if supported by the server, or fallback
            to PlainText.
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
                  state.smtpConfig?.validate_certs ??
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

      <StickyFormControls draft={smtp} />
    </div>
  );
});
