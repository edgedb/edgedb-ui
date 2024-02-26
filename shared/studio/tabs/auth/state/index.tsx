import {action, computed, observable, runInAction} from "mobx";
import {
  findParent,
  getParent,
  Model,
  model,
  modelAction,
  objectActions,
  prop,
} from "mobx-keystone";
import {parsers} from "../../../components/dataEditor/parsers";
import {connCtx, dbCtx} from "../../../state";
import {
  AppleIcon,
  AzureIcon,
  DiscordIcon,
  GithubIcon,
  GoogleIcon,
  SlackIcon,
} from "../icons";

interface AuthAppData {
  app_name: string | null;
  logo_url: string | null;
  dark_logo_url: string | null;
  brand_color: string | null;
}

export interface AuthConfigData extends AuthAppData {
  signing_key_exists: boolean;
  token_time_to_live: string;
  allowed_redirect_urls: string;
}

export type OAuthProviderData = {
  name: string;
  _typename:
    | "ext::auth::AppleOAuthProvider"
    | "ext::auth::AzureOAuthProvider"
    | "ext::auth::DiscordOAuthProvider"
    | "ext::auth::GitHubOAuthProvider"
    | "ext::auth::GoogleOAuthProvider"
    | "ext::auth::SlackOAuthProvider";
  client_id: string;
  additional_scope: string;
};
export type LocalEmailPasswordProviderData = {
  name: string;
  _typename: "ext::auth::EmailPasswordProviderConfig";
  require_verification: boolean;
};
export type LocalWebAuthnProviderData = {
  name: string;
  _typename: "ext::auth::WebAuthnProviderConfig";
  relying_party_origin: string;
  require_verification: boolean;
};
export type LocalMagicLinkProviderData = {
  name: string;
  _typename: "ext::auth::MagicLinkProviderConfig";
  token_time_to_live: string;
};
export type AuthProviderData =
  | OAuthProviderData
  | LocalEmailPasswordProviderData
  | LocalWebAuthnProviderData
  | LocalMagicLinkProviderData;

export interface AuthUIConfigData {
  redirect_to: string;
  redirect_to_on_signup: string;
}

export const smtpSecurity = [
  "PlainText",
  "TLS",
  "STARTTLS",
  "STARTTLSOrPlainText",
] as const;

export type SMTPSecurity = (typeof smtpSecurity)[number];

export interface SMTPConfigData {
  sender: string;
  host: string;
  port: string;
  username: string;
  password: string;
  security: SMTPSecurity;
  validate_certs: boolean;
  timeout_per_email: string;
  timeout_per_attempt: string;
}

export type ProviderKind = "OAuth" | "Local";

export const _providersInfo: {
  [key in AuthProviderData["_typename"]]: {
    kind: ProviderKind;
    displayName: string;
    icon: JSX.Element;
  };
} = {
  // oauth
  "ext::auth::AppleOAuthProvider": {
    kind: "OAuth",
    displayName: "Apple",
    icon: <AppleIcon />,
  },
  "ext::auth::AzureOAuthProvider": {
    kind: "OAuth",
    displayName: "Azure",
    icon: <AzureIcon />,
  },
  "ext::auth::DiscordOAuthProvider": {
    kind: "OAuth",
    displayName: "Discord",
    icon: <DiscordIcon />,
  },
  "ext::auth::GitHubOAuthProvider": {
    kind: "OAuth",
    displayName: "GitHub",
    icon: <GithubIcon />,
  },
  "ext::auth::GoogleOAuthProvider": {
    kind: "OAuth",
    displayName: "Google",
    icon: <GoogleIcon />,
  },
  "ext::auth::SlackOAuthProvider": {
    kind: "OAuth",
    displayName: "Slack",
    icon: <SlackIcon />,
  },
  // local
  "ext::auth::EmailPasswordProviderConfig": {
    kind: "Local",
    displayName: "Email + Password",
    icon: <></>,
  },
  "ext::auth::WebAuthnProviderConfig": {
    kind: "Local",
    displayName: "WebAuthn",
    icon: <></>,
  },
  "ext::auth::MagicLinkProviderConfig": {
    kind: "Local",
    displayName: "Magic link",
    icon: <></>,
  },
};

export type ProviderTypename = keyof typeof _providersInfo;

@model("AuthAdmin")
export class AuthAdminState extends Model({
  selectedTab: prop<"config" | "providers" | "smtp">("config").withSetter(),

  draftCoreConfig: prop<DraftCoreConfig | null>(null),
  draftProviderConfig: prop<DraftProviderConfig | null>(null),
  draftUIConfig: prop<DraftUIConfig | null>(null),
  draftSMTPConfig: prop(() => new DraftSMTPConfig({})),
}) {
  @computed
  get extEnabled() {
    return (
      dbCtx
        .get(this)!
        .schemaData?.extensions.some((ext) => ext.name === "auth") ?? null
    );
  }
  @computed
  get newAppAuthSchema() {
    return (
      dbCtx.get(this)!.schemaData?.objectsByName.get("ext::auth::AuthConfig")
        ?.properties["app_name"] != null
    );
  }

  @computed
  get providersInfo() {
    const objects = dbCtx.get(this)!.schemaData?.objectsByName;
    const providers = {} as typeof _providersInfo;
    for (const providerName of Object.keys(
      _providersInfo
    ) as ProviderTypename[]) {
      if (objects?.has(providerName)) {
        providers[providerName] = _providersInfo[providerName];
      }
    }
    return providers;
  }

  @computed
  get providerTypenames() {
    return Object.keys(this.providersInfo) as ProviderTypename[];
  }

  @modelAction
  addDraftProvider() {
    const existingProviders = new Set(this.providers?.map((p) => p._typename));
    this.draftProviderConfig = new DraftProviderConfig({
      selectedProviderType: this.providerTypenames.find(
        (name) => !existingProviders.has(name)
      )!,
    });
  }
  @modelAction
  cancelDraftProvider() {
    this.draftProviderConfig = null;
  }

  async removeProvider(typename: string, name: string) {
    const conn = connCtx.get(this)!;

    await conn.execute(
      `configure current database reset ${typename}
        filter .name = ${JSON.stringify(name)}`
    );
    await this.refreshConfig();
  }

  @modelAction
  _createDraftCoreConfig() {
    if (!this.draftCoreConfig) {
      this.draftCoreConfig = new DraftCoreConfig({
        appConfig: this.newAppAuthSchema ? new DraftAppConfig({}) : null,
      });
    }
  }

  @modelAction
  enableUI() {
    if (!this.draftUIConfig) {
      this.draftUIConfig = new DraftUIConfig({
        appConfig: !this.newAppAuthSchema ? new DraftAppConfig({}) : null,
      });
    }
  }

  @modelAction
  async disableUI() {
    if (this.uiConfig) {
      const conn = connCtx.get(this)!;
      await conn.execute(
        "configure current database reset ext::auth::UIConfig"
      );
    }
    objectActions.set(this, "draftUIConfig", null);

    this.refreshConfig();
  }

  onAttachedToRootStore() {}

  @observable.ref
  configData: AuthConfigData | null = null;

  @observable.ref
  providers: AuthProviderData[] | null = null;

  @observable.ref
  uiConfig: AuthUIConfigData | false | null = null;

  @observable.ref
  smtpConfig: SMTPConfigData | null = null;

  async refreshConfig() {
    const conn = connCtx.get(this)!;
    const {newAppAuthSchema} = this;

    const appConfigQuery = `
    app_name,
    logo_url,
    dark_logo_url,
    brand_color,
    `;

    const hasWebAuthn =
      !!this.providersInfo["ext::auth::WebAuthnProviderConfig"];
    const hasMagicLink =
      !!this.providersInfo["ext::auth::MagicLinkProviderConfig"];

    const {result} = await conn.query(
      `with module ext::auth
      select {
        auth := assert_single(cfg::Config.extensions[is AuthConfig] {
          signing_key_exists := signing_key_exists(),
          token_time_to_live_seconds := <str>duration_get(.token_time_to_live, 'totalseconds'),
          ${newAppAuthSchema ? appConfigQuery : ""}
          allowed_redirect_urls,
          providers: {
            _typename := .__type__.name,
            name,
            [is OAuthProviderConfig].client_id,
            [is OAuthProviderConfig].additional_scope,
            require_verification := (
              [is EmailPasswordProviderConfig].require_verification${
                hasWebAuthn
                  ? ` ?? [is WebAuthnProviderConfig].require_verification`
                  : ""
              }
            ),
            ${
              hasWebAuthn
                ? `[is WebAuthnProviderConfig].relying_party_origin,`
                : ""
            }
            ${
              hasMagicLink
                ? `token_time_to_live_seconds := <str>duration_get([is MagicLinkProviderConfig].token_time_to_live, 'totalseconds'),`
                : ""
            }
          },
          ui: {
            redirect_to,
            redirect_to_on_signup,
            ${newAppAuthSchema ? "" : appConfigQuery}
          }
        }),
        smtp := assert_single(cfg::Config.extensions[is SMTPConfig] {
          sender,
          host,
          port,
          username,
          security,
          validate_certs,
          timeout_per_email_seconds := <str>duration_get(.timeout_per_email, 'totalseconds'),
          timeout_per_attempt_seconds := <str>duration_get(.timeout_per_attempt, 'totalseconds'),
        })
      }`,
      undefined,
      {ignoreSessionConfig: true}
    );

    if (result === null) return;

    const {auth, smtp} = result[0];

    runInAction(() => {
      this.configData = {
        signing_key_exists: auth.signing_key_exists,
        token_time_to_live: auth.token_time_to_live_seconds,
        allowed_redirect_urls: auth.allowed_redirect_urls.join("\n"),
        app_name: auth.app_name ?? auth.ui?.app_name ?? null,
        logo_url: auth.logo_url ?? auth.ui?.logo_url ?? null,
        dark_logo_url: auth.dark_logo_url ?? auth.ui?.dark_logo_url ?? null,
        brand_color: auth.brand_color ?? auth.ui?.brand_color ?? null,
      };
      this.providers = auth.providers.map((p: any) =>
        p._typename === "ext::auth::MagicLinkProviderConfig"
          ? {...p, token_time_to_live: p.token_time_to_live_seconds}
          : p
      );
      this.uiConfig = auth.ui ?? false;
      this._createDraftCoreConfig();
      if (auth.ui) {
        this.enableUI();
      }
      this.smtpConfig = {
        ...smtp,
        port: smtp.port?.toString(),
        timeout_per_email: smtp.timeout_per_email_seconds,
        timeout_per_attempt: smtp.timeout_per_attempt_seconds,
      };
    });
  }
}

function validateDuration(dur: string, required: boolean) {
  dur = dur.trim();
  if (!dur.length) {
    return required ? `Duration is required` : null;
  }
  try {
    if (/^\d+$/.test(dur)) return null;
    parsers["std::duration"](dur, null);
  } catch {
    return `Invalid duration`;
  }
  return null;
}

export interface AbstractDraftConfig {
  updating: boolean;
  formChanged: boolean;
  formError: boolean;
  update: () => void;
  clearForm: () => void;
}

type AuthCoreConfigName =
  | "auth_signing_key"
  | "token_time_to_live"
  | "allowed_redirect_urls";

@model("AuthAdmin/DraftCoreConfig")
export class DraftCoreConfig
  extends Model({
    _auth_signing_key: prop<string | null>(null),
    _token_time_to_live: prop<string | null>(null),
    _allowed_redirect_urls: prop<string | null>(null),
    appConfig: prop<DraftAppConfig | null>(),
  })
  implements AbstractDraftConfig
{
  getConfigValue(name: Exclude<AuthCoreConfigName, "auth_signing_key">) {
    return (
      this[`_${name}`] ??
      (getParent<AuthAdminState>(this)?.configData || null)?.[name] ??
      ""
    );
  }

  @modelAction
  setConfigValue(name: AuthCoreConfigName, val: string) {
    this[`_${name}`] = val;
  }

  @computed
  get signingKeyError() {
    if (
      this._auth_signing_key === null &&
      getParent<AuthAdminState>(this)?.configData?.signing_key_exists
    ) {
      return null;
    }
    const key = this._auth_signing_key ?? "";
    return key === ""
      ? "Signing key is required"
      : key.length < 32
      ? "Signing key too short"
      : null;
  }

  @computed
  get tokenTimeToLiveError() {
    let dur = this._token_time_to_live;
    if (dur === null) return null;
    return validateDuration(dur, true);
  }

  @computed
  get allowedRedirectUrlsError() {
    const urls = this._allowed_redirect_urls;
    if (urls === null) return null;

    const urlList = urls.split("\n").filter((str) => str.trim() !== "");
    if (urlList.length > 128) {
      return "Too many URLs, maximum supported number of URLs is 128.";
    }

    const invalidUrls = urlList.filter((u) => {
      try {
        new URL(u);
        return false;
      } catch (e) {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      return `List contained the following invalid URLs:\n${invalidUrls.join(
        ",\n"
      )}`;
    }

    return null;
  }

  @computed
  get formError() {
    return (
      !!this.signingKeyError ||
      !!this.tokenTimeToLiveError ||
      !!this.allowedRedirectUrlsError
    );
  }

  @computed
  get formChanged() {
    return (
      this._auth_signing_key != null ||
      this._token_time_to_live != null ||
      this._allowed_redirect_urls != null ||
      (this.appConfig?.changed ?? false)
    );
  }

  @modelAction
  clearForm() {
    this._auth_signing_key = null;
    this._token_time_to_live = null;
    this._allowed_redirect_urls = null;
    this.appConfig?.clear();
  }

  @observable
  updating = false;

  @observable
  error: string | null = null;

  @action
  async update() {
    if (this.formError || !this.formChanged) return;

    const conn = connCtx.get(this)!;
    const state = getParent<AuthAdminState>(this)!;

    this.updating = true;
    this.error = null;

    const query = (
      [
        {name: "auth_signing_key", cast: null, transform: null},
        {name: "token_time_to_live", cast: "std::duration", transform: null},
        {
          name: "allowed_redirect_urls",
          cast: null,
          transform: (urls: string) => {
            const urlList = urls
              .split("\n")
              .filter((str) => str.trim() !== "");
            return `{${urlList.map((u) => JSON.stringify(u)).join(", ")}}`;
          },
        },
      ] as const
    )
      .map(({name, cast, transform}) => {
        const val = this[`_${name}`];
        if (val == null) return null;
        if (val.trim() === "") {
          return `configure current database reset ext::auth::AuthConfig::${name};`;
        }
        return `configure current database set ext::auth::AuthConfig::${name} := ${
          cast ? `<${cast}>` : ""
        }${(transform ?? JSON.stringify)(val)};`;
      })
      .filter((s) => s != null) as string[];

    if (this.appConfig) {
      query.push(...this.appConfig.getUpdateQuery(true));
    }

    try {
      await conn.execute(query.join("\n"));
      await state.refreshConfig();
      this.clearForm();
    } catch (e) {
      console.log(e);
      runInAction(
        () => (this.error = e instanceof Error ? e.message : String(e))
      );
    } finally {
      runInAction(() => (this.updating = false));
    }
  }
}

@model("AuthAdmin/DraftAppConfig")
export class DraftAppConfig extends Model({
  _app_name: prop<string | null>(null),
  _logo_url: prop<string | null>(null),
  _dark_logo_url: prop<string | null>(null),
  _brand_color: prop<string | null>(null),
}) {
  getConfigValue(name: keyof AuthAppData) {
    return (
      this[`_${name}`] ??
      (findParent<AuthAdminState>(
        this,
        (parent) => parent instanceof AuthAdminState
      )?.configData || null)?.[name] ??
      ""
    );
  }

  @modelAction
  setConfigValue<Name extends keyof AuthAppData>(
    name: Name,
    val: AuthAppData[Name]
  ) {
    (this as any)[`_${name}`] = val;
  }

  @computed
  get changed() {
    return (
      this._app_name != null ||
      this._logo_url != null ||
      this._dark_logo_url != null ||
      this._brand_color != null
    );
  }

  @modelAction
  clear() {
    this._app_name = null;
    this._logo_url = null;
    this._dark_logo_url = null;
    this._brand_color = null;
  }

  getUpdateQuery(newSchema: boolean) {
    if (!this.changed) return [];

    return (["app_name", "logo_url", "dark_logo_url", "brand_color"] as const)
      .map(
        newSchema
          ? (name) => {
              const val = this[`_${name}`];
              if (val == null) return null;
              if (typeof val === "string" && val.trim() === "") {
                return `configure current database reset ext::auth::AuthConfig::${name};`;
              }
              return `configure current database set ext::auth::AuthConfig::${name} := ${JSON.stringify(
                val
              )};`;
            }
          : (name) => {
              const val = this.getConfigValue(name);
              return val ? `${name} := ${JSON.stringify(val)}` : null;
            }
      )
      .filter((s) => s != null) as string[];
  }
}

@model("AuthAdmin/DraftUIConfig")
export class DraftUIConfig extends Model({
  _redirect_to: prop<string | null>(null),
  _redirect_to_on_signup: prop<string | null>(null),
  appConfig: prop<DraftAppConfig | null>(),

  showDarkTheme: prop<boolean | null>(null).withSetter(),
}) {
  getConfigValue(name: keyof AuthUIConfigData) {
    return (
      this[`_${name}`] ??
      (getParent<AuthAdminState>(this)?.uiConfig || null)?.[name] ??
      ""
    );
  }

  @modelAction
  setConfigValue(name: keyof AuthUIConfigData, val: string) {
    this[`_${name}`] = val;
  }

  @computed
  get redirectToError() {
    return !this.getConfigValue("redirect_to").length
      ? `Redirect url is required`
      : null;
  }

  @computed
  get formError() {
    return this.redirectToError != null;
  }

  @computed
  get formChanged() {
    return (
      this._redirect_to != null ||
      this._redirect_to_on_signup != null ||
      (this.appConfig?.changed ?? false)
    );
  }

  @modelAction
  clearForm() {
    this._redirect_to = null;
    this._redirect_to_on_signup = null;
    this.appConfig?.clear();
  }

  @observable
  updating = false;

  @observable
  error: string | null = null;

  @action
  async update() {
    if (this.formError || !this.formChanged) return;

    const conn = connCtx.get(this)!;
    const state = getParent<AuthAdminState>(this)!;

    this.updating = true;
    this.error = null;

    try {
      await conn.execute(`
        configure current database reset ext::auth::UIConfig;
        configure current database
          insert ext::auth::UIConfig {
            redirect_to := ${JSON.stringify(
              this.getConfigValue("redirect_to")
            )},
            ${[
              ...(["redirect_to_on_signup"] as const)
                .map((name) => {
                  const val = this.getConfigValue(name);
                  return val ? `${name} := ${JSON.stringify(val)}` : null;
                })
                .filter((l) => l),
              ...(this.appConfig?.getUpdateQuery(false) ?? []),
            ].join(",\n")}
          };`);
      await state.refreshConfig();
      this.clearForm();
    } catch (e) {
      runInAction(
        () => (this.error = e instanceof Error ? e.message : String(e))
      );
    } finally {
      runInAction(() => (this.updating = false));
    }
  }
}

@model("AuthAdmin/DraftSMTPConfig")
export class DraftSMTPConfig
  extends Model({
    _sender: prop<string | null>(null),
    _host: prop<string | null>(null),
    _port: prop<string | null>(null),
    _username: prop<string | null>(null),
    _password: prop<string | null>(null),
    _security: prop<SMTPSecurity | null>(null),
    _validate_certs: prop<boolean | null>(null),
    _timeout_per_email: prop<string | null>(null),
    _timeout_per_attempt: prop<string | null>(null),
  })
  implements AbstractDraftConfig
{
  getConfigValue(name: Exclude<keyof SMTPConfigData, "validate_certs">) {
    return (
      this[`_${name}`] ??
      (getParent<AuthAdminState>(this)?.smtpConfig || null)?.[name] ??
      ""
    );
  }

  @modelAction
  setConfigValue<Name extends keyof SMTPConfigData>(
    name: Name,
    val: SMTPConfigData[Name]
  ) {
    (this as any)[`_${name}`] = val;
  }

  @computed
  get portError() {
    const val = this.getConfigValue("port").trim();
    if (val === "") {
      return null;
    }
    const int = parseInt(val, 10);
    if (!/^\d+$/.test(val) || Number.isNaN(int) || int < 0 || int > 65535) {
      return `Port must be an integer between 0 and 65535`;
    }
    return null;
  }

  @computed
  get timeoutPerEmailError() {
    const val = this.getConfigValue("timeout_per_email").trim();
    if (!val.length) {
      return `Value is required`;
    }
    try {
      if (/^\d+$/.test(val)) return null;
      parsers["std::duration"](val, null);
    } catch {
      return `Invalid duration`;
    }
    return null;
  }

  @computed
  get timeoutPerAttemptError() {
    const val = this.getConfigValue("timeout_per_attempt").trim();
    if (!val.length) {
      return `Value is required`;
    }
    try {
      if (/^\d+$/.test(val)) return null;
      parsers["std::duration"](val, null);
    } catch {
      return `Invalid duration`;
    }
    return null;
  }

  @computed
  get formError() {
    return (
      !!this.portError ||
      !!this.timeoutPerEmailError ||
      !!this.timeoutPerAttemptError
    );
  }

  @computed
  get formChanged() {
    return (
      this._sender != null ||
      this._host != null ||
      this._port != null ||
      this._username != null ||
      this._password != null ||
      this._security != null ||
      this._validate_certs != null ||
      this._timeout_per_email != null ||
      this._timeout_per_attempt != null
    );
  }

  @modelAction
  clearForm() {
    this._sender = null;
    this._host = null;
    this._port = null;
    this._username = null;
    this._password = null;
    this._security = null;
    this._validate_certs = null;
    this._timeout_per_email = null;
    this._timeout_per_attempt = null;
  }

  @observable
  updating = false;

  @observable
  error: string | null = null;

  @action
  async update() {
    if (this.formError || !this.formChanged) return;

    const conn = connCtx.get(this)!;
    const state = getParent<AuthAdminState>(this)!;

    this.updating = true;
    this.error = null;

    const query = (
      [
        {name: "sender", cast: null},
        {name: "host", cast: null},
        {name: "port", cast: "int32"},
        {name: "username", cast: null},
        {name: "password", cast: null},
        {name: "security", cast: "ext::auth::SMTPSecurity"},
        {name: "validate_certs", cast: null},
        {name: "timeout_per_email", cast: "std::duration"},
        {name: "timeout_per_attempt", cast: "std::duration"},
      ] as const
    )
      .map(({name, cast}) => {
        const val = this[`_${name}`];
        if (val == null) return null;
        if (typeof val === "string" && val.trim() === "") {
          return `configure current database reset ext::auth::SMTPConfig::${name};`;
        }
        return `configure current database set ext::auth::SMTPConfig::${name} := ${
          cast ? `<${cast}>` : ""
        }${JSON.stringify(val)};`;
      })
      .filter((s) => s != null)
      .join("\n");

    try {
      await conn.execute(query);
      await state.refreshConfig();
      this.clearForm();
    } catch (e) {
      console.log(e);
      runInAction(
        () => (this.error = e instanceof Error ? e.message : String(e))
      );
    } finally {
      runInAction(() => (this.updating = false));
    }
  }
}

@model("AuthAdmin/DraftProviderConfig")
export class DraftProviderConfig extends Model({
  selectedProviderType: prop<ProviderTypename>().withSetter(),

  oauthClientId: prop("").withSetter(),
  oauthSecret: prop("").withSetter(),
  additionalScope: prop("").withSetter(),

  webauthnRelyingOrigin: prop("").withSetter(),

  requireEmailVerification: prop(true).withSetter(),

  tokenTimeToLive: prop("").withSetter(),
}) {
  @computed
  get oauthClientIdError() {
    return this.oauthClientId.trim() === "" ? "Client ID is required" : null;
  }

  @computed
  get oauthSecretError() {
    return this.oauthSecret.trim() === "" ? "Secret is required" : null;
  }

  @computed
  get webauthnRelyingOriginError() {
    const origin = this.webauthnRelyingOrigin.trim();
    if (origin === "") {
      return "Relying origin is required";
    }
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return "Invalid origin";
    }
    if (!url.protocol || !url.host) {
      return "Relying origin must contain a protocol and host";
    }
    if (
      url.username ||
      url.password ||
      !(url.pathname === "" || url.pathname === "/") ||
      url.search ||
      url.hash
    ) {
      return "Relying origin can only contain protocol, hostname and port";
    }
    return null;
  }

  @computed
  get tokenTimeToLiveError() {
    return validateDuration(this.tokenTimeToLive, false);
  }

  @computed
  get formValid(): boolean {
    switch (_providersInfo[this.selectedProviderType].kind) {
      case "OAuth":
        return !this.oauthClientIdError && !this.oauthSecretError;
      case "Local":
        return this.selectedProviderType ===
          "ext::auth::WebAuthnProviderConfig"
          ? !this.webauthnRelyingOriginError
          : this.selectedProviderType === "ext::auth::MagicLinkProviderConfig"
          ? !this.tokenTimeToLiveError
          : true;
    }
  }

  @observable
  updating = false;

  @observable
  error: string | null = null;

  @action
  async addProvider() {
    if (!this.formValid) return;

    const conn = connCtx.get(this)!;
    const state = getParent<AuthAdminState>(this)!;

    this.updating = true;
    this.error = null;

    try {
      const provider = _providersInfo[this.selectedProviderType];

      const queryFields: string[] = [];
      if (provider.kind === "OAuth") {
        queryFields.push(
          `client_id := ${JSON.stringify(this.oauthClientId)}`,
          `secret := ${JSON.stringify(this.oauthSecret)}`
        );
        if (this.additionalScope.trim()) {
          queryFields.push(
            `additional_scope := ${JSON.stringify(
              this.additionalScope.trim()
            )}`
          );
        }
      } else if (provider.kind === "Local") {
        if (
          this.selectedProviderType === "ext::auth::WebAuthnProviderConfig"
        ) {
          queryFields.push(
            `relying_party_origin := ${JSON.stringify(
              this.webauthnRelyingOrigin
            )}`
          );
        }
        if (
          this.selectedProviderType === "ext::auth::WebAuthnProviderConfig" ||
          this.selectedProviderType ===
            "ext::auth::EmailPasswordProviderConfig"
        ) {
          queryFields.push(
            `require_verification := ${
              this.requireEmailVerification ? "true" : "false"
            }`
          );
        }
        if (
          this.selectedProviderType === "ext::auth::MagicLinkProviderConfig" &&
          this.tokenTimeToLive.trim() !== ""
        ) {
          queryFields.push(
            `token_time_to_live := <std::duration>${JSON.stringify(
              this.tokenTimeToLive
            )}`
          );
        }
      }

      await conn.execute(
        `configure current database
          insert ${this.selectedProviderType} {
            ${queryFields.join(",\n")}
          }`
      );
      await state.refreshConfig();
      state.cancelDraftProvider();
    } catch (e) {
      console.log(e);
      runInAction(
        () => (this.error = e instanceof Error ? e.message : String(e))
      );
    } finally {
      runInAction(() => (this.updating = false));
    }
  }
}
