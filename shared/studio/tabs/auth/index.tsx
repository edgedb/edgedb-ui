import {useEffect, useMemo, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import {HexColorPicker, HexColorInput} from "react-colorful";

import cn from "@edgedb/common/utils/classNames";

import styles from "./authAdmin.module.scss";

import {DatabaseTabSpec} from "../../components/databasePage";

import {useInstanceState} from "../../state/instance";
import {useDatabaseState, useTabState} from "../../state";

import {
  BookIcon,
  ChevronDownIcon,
  CopyIcon,
  DeleteIcon,
  TabAuthIcon,
} from "../../icons";
import {
  AuthAdminState,
  AuthProviderData,
  DraftProviderConfig,
  ProviderTypename,
  providerTypenames,
  providers,
  DraftUIConfig,
  ProviderKind,
  OAuthProviderData,
  LocalEmailPasswordProviderData,
} from "./state";

import {encodeB64} from "edgedb/dist/primitives/buffer";
import Button from "@edgedb/common/ui/button";
import {GenerateKeyIcon} from "./icons";
import {Select, SelectItem} from "@edgedb/common/ui/select";
import {LoginUIPreview} from "./loginUIPreview";
import {normaliseHexColor} from "./colourUtils";
import {useTheme, Theme} from "@edgedb/common/hooks/useTheme";
import {
  DarkThemeIcon,
  LightThemeIcon,
} from "@edgedb/common/ui/themeSwitcher/icons";
import CodeBlock from "@edgedb/common/ui/codeBlock";
import {CustomScrollbars} from "@edgedb/common/ui/customScrollbar";
import {CheckIcon} from "@edgedb/common/ui/icons";

export const AuthAdmin = observer(function AuthAdmin() {
  const state = useTabState(AuthAdminState);

  return (
    <div className={styles.authAdmin}>
      {state.extEnabled === null ? (
        <div className={styles.loadingSchema}>Loading schema...</div>
      ) : state.extEnabled ? (
        <CustomScrollbars
          className={styles.scrollWrapper}
          innerClass={styles.tabContent}
        >
          <div className={styles.contentWrapper}>
            {state.selectedTab === "config" ? <ConfigPage /> : null}
          </div>
        </CustomScrollbars>
      ) : (
        <div className={styles.extDisabled}>
          <h2>The auth extension is not enabled</h2>
          <p>To enable it add the following to your schema:</p>
          <CodeBlock code="using extension auth;" />
          <p>
            For more information check out the{" "}
            <a href="https://www.edgedb.com/p/auth-ext-docs" target="_blank">
              auth extension docs
            </a>
          </p>
        </div>
      )}
    </div>
  );
});

export const authAdminTabSpec: DatabaseTabSpec = {
  path: "auth",
  label: "Auth Admin",
  icon: (active) => <TabAuthIcon active={active} />,
  usesSessionState: false,
  element: <AuthAdmin />,
  state: AuthAdminState,
};

const secretPlaceholder = "".padStart(32, "•");

const AuthUrls = observer(function AuthUrls({
  builtinUIEnabled,
}: {
  builtinUIEnabled: boolean;
}) {
  const instanceState = useInstanceState();
  const databaseState = useDatabaseState();

  const url = new URL(instanceState.serverUrl);
  if (url.hostname.endsWith(".edgedb.cloud")) {
    url.port = "";
  }
  url.pathname = `db/${databaseState.name}/ext/auth`;

  const baseUrl = url.toString();

  return (
    <div className={styles.authUrls}>
      <div className={styles.label}>OAuth callback endpoint:</div>
      <CopyUrl url={`${baseUrl}/callback`} />
      <div
        className={cn({[styles.disabled]: !builtinUIEnabled})}
        style={{display: "contents"}}
      >
        <div className={styles.label}>Built-in UI sign in url:</div>
        <CopyUrl url={`${baseUrl}/ui/signin`} />
        <div className={styles.label}>Built-in UI sign up url:</div>
        <CopyUrl url={`${baseUrl}/ui/signup`} />
      </div>
    </div>
  );
});

function CopyUrl({url}: {url: string}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  return (
    <div className={cn(styles.copyUrl, {[styles.copied]: copied})}>
      <span>{url}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

const ConfigPage = observer(function ConfigPage() {
  const state = useTabState(AuthAdminState);

  useEffect(() => {
    state.refreshConfig();
  }, []);

  return (
    <div className={styles.tabContent}>
      <div className={styles.docsNote}>
        <BookIcon />
        <div>
          <b>Need help integrating EdgeDB Auth into your app?</b>
          <br />
          Check out the{" "}
          <a href="https://www.edgedb.com/p/auth-ext-docs" target="_blank">
            auth extension docs
          </a>
          , also here are some useful URLs:
          <AuthUrls builtinUIEnabled={state.draftUIConfig !== null} />
        </div>
      </div>

      <div className={styles.header}>Auth Configuration</div>
      <div className={styles.configGrid}>
        <div className={styles.gridItem}>
          <div className={styles.configName}>auth_signing_key</div>
          <div className={styles.configInputWrapper}>
            <div className={styles.configInput}>
              {state.configData ? (
                state.draftSigningKey.value !== null ||
                !state.configData.signing_key_exists ? (
                  <>
                    <Input
                      value={state.draftSigningKey.value ?? ""}
                      onChange={(key) => state.draftSigningKey.setValue(key)}
                      error={state.draftSigningKey.error}
                      size={32.5}
                      showGenerateKey
                    />
                    <Button
                      className={styles.button}
                      label={
                        state.draftSigningKey.updating ? "Updating" : "Update"
                      }
                      disabled={!!state.draftSigningKey.error}
                      loading={state.draftSigningKey.updating}
                      onClick={() => state.draftSigningKey.update()}
                    />
                    {state.configData.signing_key_exists ? (
                      <Button
                        className={styles.button}
                        label="Cancel"
                        onClick={() => state.draftSigningKey.setValue(null)}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    <div
                      className={cn(
                        styles.input,
                        styles.disabled,
                        styles.placeholder
                      )}
                    >
                      {secretPlaceholder}
                    </div>
                    <Button
                      className={styles.button}
                      label="Change"
                      onClick={() => state.draftSigningKey.setValue("")}
                    />
                  </>
                )
              ) : (
                "loading..."
              )}
            </div>
            <div className={styles.configExplain}>
              The signing key used for auth extension. Must be at least 32
              characters long.
            </div>
          </div>
        </div>

        <div className={styles.gridItem}>
          <div className={styles.configName}>token_time_to_live</div>
          <div className={styles.configInputWrapper}>
            <div className={styles.configInput}>
              {state.configData ? (
                <>
                  <Input
                    size={16}
                    value={
                      state.draftTokenTime.value ??
                      state.configData.token_time_to_live
                    }
                    onChange={(dur) => state.draftTokenTime.setValue(dur)}
                    error={state.draftTokenTime.error}
                  />
                  {state.draftTokenTime.value != null ? (
                    <>
                      <Button
                        className={styles.button}
                        label={
                          state.draftTokenTime.updating ? "Updating" : "Update"
                        }
                        disabled={!!state.draftTokenTime.error}
                        loading={state.draftTokenTime.updating}
                        onClick={() => state.draftTokenTime.update()}
                      />
                      <Button
                        className={styles.button}
                        label="Cancel"
                        onClick={() => state.draftTokenTime.setValue(null)}
                      />
                    </>
                  ) : null}
                </>
              ) : (
                "loading..."
              )}
            </div>
            <div className={styles.configExplain}>
              The number of seconds after which an auth token expires. A value
              of 0 indicates that the token should never expire.
            </div>
          </div>
        </div>

        <div className={styles.gridItem}>
          <div className={styles.configName}>allowed_redirect_urls</div>
          <div className={styles.configInputWrapper}>
            <div className={styles.configInput}>
              {state.configData ? (
                <>
                  <TextArea
                    value={
                      state.draftAllowedRedirectUrls.value ??
                      state.configData.allowed_redirect_urls
                    }
                    onChange={(urls) => state.draftAllowedRedirectUrls.setValue(urls)}
                    error={state.draftAllowedRedirectUrls.error}
                    size={32.5}
                  />
                  {state.draftAllowedRedirectUrls.value != null ? (
                    <>
                      <Button
                        className={styles.button}
                        label={
                          state.draftTokenTime.updating ? "Updating" : "Update"
                        }
                        disabled={!!state.draftAllowedRedirectUrls.error}
                        loading={state.draftAllowedRedirectUrls.updating}
                        onClick={() => state.draftAllowedRedirectUrls.update()}
                      />
                      <Button
                        className={styles.button}
                        label="Cancel"
                        onClick={() => state.draftAllowedRedirectUrls.setValue(null)}
                      />
                    </>
                  ) : null}
                </>
              ) : (
                "loading..."
              )}
            </div>
            <div className={styles.configExplain}>
                New line seperated list of URLs that will be checked against
                this list to ensure they are going to a trusted domain controlled
                by the application. URLs are matched based on checking if the
                candidate redirect URL is a match or a subdirectory of any of
                these allowed URLs
            </div>
          </div>
        </div>
      </div>

      <div className={styles.header}>Providers</div>
      {state.providers ? (
        <>
          <div className={styles.providersList}>
            {state.providers.length ? (
              state.providers.map((provider) => (
                <ProviderCard key={provider.name} provider={provider} />
              ))
            ) : (
              <div className={styles.noProviders}>
                No providers are configured
              </div>
            )}
          </div>
          {state.draftProviderConfig ? (
            <DraftProviderConfigForm draftState={state.draftProviderConfig} />
          ) : state.providers.length < providerTypenames.length ? (
            <Button
              className={styles.button}
              label="Add Provider"
              onClick={() => state.addDraftProvider()}
            />
          ) : null}
        </>
      ) : (
        "loading..."
      )}

      <div className={styles.header}>Login UI</div>
      {state.draftUIConfig ? (
        <UIConfigForm draft={state.draftUIConfig} />
      ) : (
        <Button
          className={styles.button}
          label="Enable UI"
          onClick={() => state.enableUI()}
        />
      )}
    </div>
  );
});

const UIConfigForm = observer(function UIConfig({
  draft,
}: {
  draft: DraftUIConfig;
}) {
  const state = useTabState(AuthAdminState);
  const [_, theme] = useTheme();

  const [disablingUI, setDisablingUI] = useState(false);

  return (
    <div className={styles.uiConfigSection}>
      <div>
        <div className={styles.configGrid}>
          <div className={styles.gridItem}>
            <div className={styles.configName}>redirect_to</div>
            <div className={styles.configInputWrapper}>
              <div className={styles.configInput}>
                <Input
                  size={32}
                  value={draft.getConfigValue("redirect_to")}
                  onChange={(val) => draft.setConfigValue("redirect_to", val)}
                  error={draft.redirectToError}
                />
              </div>
              <div className={styles.configExplain}>
                The url to redirect to after successful sign in.
              </div>
            </div>
          </div>

          <div className={styles.gridItem}>
            <div className={styles.configName}>redirect_to_on_signup</div>
            <div className={styles.configInputWrapper}>
              <div className={styles.configInput}>
                <Input
                  size={32}
                  value={draft.getConfigValue("redirect_to_on_signup")}
                  onChange={(val) =>
                    draft.setConfigValue("redirect_to_on_signup", val)
                  }
                />
              </div>
              <div className={styles.configExplain}>
                The url to redirect to after a new user signs up. If not set,
                'redirect_to' will be used instead.
              </div>
            </div>
          </div>

          <div className={styles.gridItem}>
            <div className={styles.configName}>app_name</div>
            <div className={styles.configInputWrapper}>
              <div className={styles.configInput}>
                <Input
                  size={32}
                  value={draft.getConfigValue("app_name")}
                  onChange={(val) => draft.setConfigValue("app_name", val)}
                />
              </div>
              <div className={styles.configExplain}>
                The name of your application to be shown on the login screen.
              </div>
            </div>
          </div>

          <div className={styles.gridItem}>
            <div className={styles.configName}>logo_url</div>
            <div className={styles.configInputWrapper}>
              <div className={styles.configInput}>
                <Input
                  size={32}
                  value={draft.getConfigValue("logo_url")}
                  onChange={(val) => draft.setConfigValue("logo_url", val)}
                />
              </div>
              <div className={styles.configExplain}>
                A url to an image of your application's logo.
              </div>
            </div>
          </div>

          <div className={styles.gridItem}>
            <div className={styles.configName}>dark_logo_url</div>
            <div className={styles.configInputWrapper}>
              <div className={styles.configInput}>
                <Input
                  size={32}
                  value={draft.getConfigValue("dark_logo_url")}
                  onChange={(val) =>
                    draft.setConfigValue("dark_logo_url", val)
                  }
                />
              </div>
              <div className={styles.configExplain}>
                A url to an image of your application's logo to be used with
                the dark theme.
              </div>
            </div>
          </div>

          <div className={styles.gridItem}>
            <div className={styles.configName}>brand_color</div>
            <div className={styles.configInputWrapper}>
              <div className={styles.configInput}>
                <div className={styles.inputWrapper}>
                  <ColorPickerInput
                    color={draft.getConfigValue("brand_color")}
                    onChange={(color) =>
                      draft.setConfigValue("brand_color", color.slice(1))
                    }
                  />
                </div>
                <ColorPickerPopup
                  color={draft.getConfigValue("brand_color")}
                  onChange={(color) =>
                    draft.setConfigValue("brand_color", color.slice(1))
                  }
                />
              </div>
              <div className={styles.configExplain}>
                The brand color of your application as a hex string.
              </div>
            </div>
          </div>
        </div>

        <div className={styles.uiConfigFormButtons}>
          <Button
            className={styles.button}
            label="Update"
            onClick={() => draft.update()}
            disabled={draft.formError || !draft.formChanged || draft.updating}
            loading={draft.updating}
          />
          {state.uiConfig && draft.formChanged ? (
            <Button
              className={styles.button}
              label="Clear Changes"
              onClick={() => draft.clearForm()}
            />
          ) : null}

          <Button
            className={cn(styles.button, styles.disableButton)}
            label="Disable UI"
            onClick={() => {
              setDisablingUI(true);
              state.disableUI();
            }}
            loading={disablingUI}
            disabled={disablingUI}
          />
        </div>
      </div>
      <div className={styles.loginUIPreview}>
        <div className={styles.loginUIPreviewHeader}>
          <span>Preview</span>
          <div
            className={styles.themeSwitch}
            onClick={() =>
              draft.setShowDarkTheme(
                !(draft.showDarkTheme ?? theme === Theme.dark)
              )
            }
          >
            {draft.showDarkTheme ?? theme == Theme.dark ? (
              <>
                <DarkThemeIcon /> Dark theme
              </>
            ) : (
              <>
                <LightThemeIcon /> Light theme
              </>
            )}
          </div>
        </div>
        <LoginUIPreview
          draft={draft}
          providers={state.providers ?? []}
          darkTheme={draft.showDarkTheme ?? theme == Theme.dark}
        />
      </div>
    </div>
  );
});

function ColorPickerInput({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector("input")?.addEventListener("input", (e) => {
      if ((e.target as HTMLInputElement).value === "") {
        onChange("");
      }
    });
  }, []);

  return (
    <div ref={ref} className={styles.input} style={{"--prefixLen": 1} as any}>
      <div className={styles.prefix}>#</div>
      <HexColorInput
        size={7}
        color={color}
        onChange={onChange}
        onBlur={() => {
          if (color) onChange("#" + normaliseHexColor(color));
        }}
      />
    </div>
  );
}

function ColorPickerPopup({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("click", listener, {capture: true});
    return () => {
      window.removeEventListener("click", listener, {capture: true});
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={styles.colorPickerSwatch}
      onClick={() => setOpen(true)}
      style={{backgroundColor: `#${color || "1f8aed"}`}}
    >
      {open ? (
        <HexColorPicker
          className={styles.colorPickerPopup}
          color={color}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}

function getProviderSelectItems(existingProviders: Set<string>) {
  return {
    items: [],
    groups: Object.entries(
      Object.entries(providers).reduce<{
        [group in ProviderKind]: SelectItem<ProviderTypename>[];
      }>((items, [id, provider]) => {
        if (!items[provider.kind]) {
          items[provider.kind] = [];
        }
        items[provider.kind].push({
          id: id as ProviderTypename,
          label: (
            <div className={styles.providerSelectItem}>
              {provider.icon}
              {provider.displayName}
            </div>
          ),
          disabled: existingProviders.has(id),
        });
        return items;
      }, {} as any)
    ).map(([label, items]) => ({label, items})),
  };
}

const DraftProviderConfigForm = observer(function DraftProviderConfigForm({
  draftState,
}: {
  draftState: DraftProviderConfig;
}) {
  const state = useTabState(AuthAdminState);

  const providerItems = useMemo(
    () =>
      getProviderSelectItems(
        new Set(state.providers?.map((p) => p._typename))
      ),
    [state.providers]
  );
  const providerKind = providers[draftState.selectedProviderType].kind;

  return (
    <div className={styles.addProviderForm}>
      <div className={styles.configGrid}>
        <div className={styles.gridItem}>
          <div className={styles.configName}>provider</div>
          <div className={styles.configInput}>
            <Select
              className={styles.providerSelect}
              selectedItemId={draftState.selectedProviderType}
              onChange={(item) => draftState.setSelectedProviderType(item.id)}
              items={providerItems}
            />
          </div>
        </div>

        {providerKind === "OAuth" ? (
          <>
            <div className={styles.gridItem}>
              <div className={styles.configName}>client_id</div>
              <div className={styles.configInputWrapper}>
                <div className={styles.configInput}>
                  <Input
                    size={32}
                    value={draftState.oauthClientId}
                    onChange={(val) => draftState.setOauthClientId(val)}
                    error={draftState.oauthClientIdError}
                  />
                </div>
                <div className={styles.configExplain}>
                  ID for client provided by auth provider.
                </div>
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.configName}>secret</div>
              <div className={styles.configInputWrapper}>
                <div className={styles.configInput}>
                  <Input
                    size={32}
                    value={draftState.oauthSecret}
                    onChange={(val) => draftState.setOauthSecret(val)}
                    error={draftState.oauthSecretError}
                  />
                </div>
                <div className={styles.configExplain}>
                  Secret provided by auth provider.
                </div>
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.configName}>additional_scope</div>
              <div className={styles.configInputWrapper}>
                <div className={styles.configInput}>
                  <Input
                    size={32}
                    value={draftState.additionalScope}
                    onChange={(val) => draftState.setAdditionalScope(val)}
                  />
                </div>
                <div className={styles.configExplain}>
                  Space-separated list of scopes to be included in the
                  authorize request to the OAuth provider.
                </div>
              </div>
            </div>
          </>
        ) : providerKind === "Local" ? (
          <div className={styles.gridItem}>
            <div className={styles.configName}>require_verification</div>
            <div className={styles.configInputWrapper}>
              <div className={styles.configInput}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={draftState.requireEmailVerification}
                    onChange={(e) =>
                      draftState.setRequireEmailVerification(e.target.checked)
                    }
                  />
                </label>
              </div>
              <div className={styles.configExplain}>
                Whether the email needs to be verified before the user is
                allowed to sign in.
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {draftState.error ? (
        <div className={styles.errorMessage}>{draftState.error}</div>
      ) : null}

      <div className={styles.addProviderFormButtons}>
        <Button
          className={styles.button}
          label={draftState.updating ? "Adding Provider..." : "Add Provider"}
          loading={draftState.updating}
          disabled={!draftState.formValid || draftState.updating}
          onClick={() => draftState.addProvider()}
        />
        <Button
          className={styles.button}
          label={"Cancel"}
          onClick={() => state.cancelDraftProvider()}
        />
      </div>
    </div>
  );
});

function ProviderCard({provider}: {provider: AuthProviderData}) {
  const state = useTabState(AuthAdminState);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const {displayName, icon, kind} = providers[provider._typename];

  return (
    <div className={styles.providerCard}>
      <div className={styles.providerCardHeader}>
        <div
          className={cn(styles.expandProvider, {
            [styles.collapsed]: !expanded,
            // [styles.disabled]: kind !== "OAuth",
          })}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDownIcon />
        </div>
        {icon}
        {displayName}
        <div className={styles.providerType}>{kind}</div>

        <Button
          className={cn(styles.removeProviderButton, {
            [styles.noHide]: deleting,
          })}
          icon={<DeleteIcon className={styles.icon} />}
          leftIcon
          label={deleting ? "Removing..." : "Remove"}
          loading={deleting}
          onClick={() => {
            setDeleting(true);
            state.removeProvider(provider._typename, provider.name);
          }}
        />
      </div>
      {expanded ? (
        <div className={styles.providerDetails}>
          {kind === "OAuth" ? (
            <>
              <div className={styles.providerConfigName}>client_id</div>
              <div className={styles.providerConfigValue}>
                {(provider as OAuthProviderData).client_id}
              </div>

              <div className={styles.providerConfigName}>secret</div>
              <div className={styles.providerConfigValue}>
                {secretPlaceholder}
              </div>

              <div className={styles.providerConfigName}>additional_scope</div>
              <div className={styles.providerConfigValue}>
                {(provider as OAuthProviderData).additional_scope || (
                  <span>none</span>
                )}
              </div>
            </>
          ) : kind === "Local" ? (
            <>
              <div className={styles.providerConfigName}>
                require_verification
              </div>
              <div className={styles.providerConfigValue}>
                {(
                  provider as LocalEmailPasswordProviderData
                ).require_verification.toString()}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Input({
  value,
  onChange,
  error,
  showGenerateKey = false,
  size,
}: {
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  showGenerateKey?: boolean;
  size?: number;
}) {
  return (
    <div className={styles.inputWrapper}>
      <div className={cn(styles.input, {[styles.error]: !!error})}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          size={size}
        />
        {showGenerateKey ? (
          <div
            className={styles.generateKeyButton}
            onClick={() =>
              onChange(
                encodeB64(crypto.getRandomValues(new Uint8Array(256))).replace(
                  /=*$/,
                  ""
                )
              )
            }
          >
            <GenerateKeyIcon />
            <span>Generate Random Key</span>
          </div>
        ) : null}
      </div>
      {error ? <div className={styles.inputErrorMessage}>{error}</div> : null}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  error,
  size,
}: {
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  size?: number;
}) {
  return (
    <div className={styles.inputWrapper}>
      <div className={cn(styles.input, {[styles.error]: !!error})}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{height: 22 * (value?.split("\n").length ?? 1) + 10 + "px", width: size ? `${size}ch` : undefined}}
        />
      </div>
      {error ? <div className={styles.inputErrorMessage}>{error}</div> : null}
    </div>
  );
}
