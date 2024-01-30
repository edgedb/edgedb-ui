import {action, computed, observable, runInAction} from "mobx";
import {
  getParent,
  Model,
  model,
  modelAction,
  objectActions,
  prop,
} from "mobx-keystone";
import {parsers} from "../../../components/dataEditor/parsers";
import {connCtx, dbCtx} from "../../../state";
import {AppleIcon, AzureIcon, GithubIcon, GoogleIcon} from "../icons";

export interface AuthConfigData {
  signing_key_exists: boolean;
  token_time_to_live: string;
  allowed_redirect_urls: string;
  app_name: string | null;
  logo_url: string | null;
  dark_logo_url: string | null;
  brand_color: string | null;
}

export type OAuthProviderData = {
  name: string;
  _typename:
    | "ext::auth::AppleOAuthProvider"
    | "ext::auth::AzureOAuthProvider"
    | "ext::auth::GitHubOAuthProvider"
    | "ext::auth::GoogleOAuthProvider";
  client_id: string;
  additional_scope: string;
};
export type LocalEmailPasswordProviderData = {
  name: string;
  _typename: "ext::auth::EmailPasswordProviderConfig";
  require_verification: boolean;
};
export type AuthProviderData =
  | OAuthProviderData
  | LocalEmailPasswordProviderData;

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

export const providers: {
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
  // local
  "ext::auth::EmailPasswordProviderConfig": {
    kind: "Local",
    displayName: "Email + Password",
    icon: <></>,
  },
};

export type ProviderTypename = keyof typeof providers;

export const providerTypenames = Object.keys(providers) as ProviderTypename[];

@model("AuthAdmin")
export class AuthAdminState extends Model({
  selectedTab: prop<"config" | "providers" | "smtp">("config").withSetter(),

  draftSigningKey: createDraftAuthConfig(
    "auth_signing_key",
    "std::str",
    (key) =>
      (key ?? "") === ""
        ? "Signing key is required"
        : (key ?? "").length < 32
        ? "Signing key too short"
        : null
  ),
  draftTokenTime: createDraftAuthConfig(
    "token_time_to_live",
    "std::duration",
    (dur) => {
      if (dur === null) return null;
      dur = dur.trim();
      if (!dur.length) {
        return `Duration is required`;
      }
      try {
        if (/^\d+$/.test(dur)) return null;
        parsers["std::duration"](dur, null);
      } catch {
        return `Invalid duration`;
      }
      return null;
    }
  ),
  draftAllowedRedirectUrls: createDraftAuthConfig(
    "allowed_redirect_urls",
    "std::str",
    (urls) => {
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
    },
    (urls) => {
      if (urls === null) return "{}";
      const urlList = urls.split("\n").filter((str) => str.trim() !== "");
      return `{${urlList.map((u) => JSON.stringify(u)).join(", ")}}`;
    }
  ),
  draftAppName: createDraftAuthConfig(
    "app_name",
    "std::str",
    () => null,
  ),
  draftLogoUrl: createDraftAuthConfig(
    "logo_url",
    "std::str",
    () => null,
  ),
  draftDarkLogoUrl: createDraftAuthConfig(
    "dark_logo_url",
    "std::str",
    () => null,
  ),
  draftBrandColor: createDraftAuthConfig(
    "brand_color",
    "std::str",
    () => null,
  ),

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

  @modelAction
  addDraftProvider() {
    const existingProviders = new Set(this.providers?.map((p) => p._typename));
    this.draftProviderConfig = new DraftProviderConfig({
      selectedProviderType: providerTypenames.find(
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
  enableUI() {
    if (!this.draftUIConfig) {
      this.draftUIConfig = new DraftUIConfig({});
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

    const {result} = await conn.query(
      `with module ext::auth
      select {
        auth := assert_single(cfg::Config.extensions[is AuthConfig] {
          signing_key_exists := signing_key_exists(),
          token_time_to_live_seconds := <str>duration_get(.token_time_to_live, 'totalseconds'),
          app_name,
          logo_url,
          dark_logo_url,
          brand_color,
          allowed_redirect_urls,
          providers: {
            _typename := .__type__.name,
            name,
            [is OAuthProviderConfig].client_id,
            [is OAuthProviderConfig].additional_scope,
            [is EmailPasswordProviderConfig].require_verification,
          },
          ui: {
            redirect_to,
            redirect_to_on_signup,
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
        app_name: auth.app_name,
        logo_url: auth.logo_url,
        dark_logo_url: auth.dark_logo_url,
        brand_color: auth.brand_color,
      };
      this.providers = auth.providers;
      this.uiConfig = auth.ui ?? false;
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

@model("AdminDraftUIConfig")
export class DraftUIConfig extends Model({
  _redirect_to: prop<string | null>(null),
  _redirect_to_on_signup: prop<string | null>(null),

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
      this._redirect_to_on_signup != null
    );
  }

  @modelAction
  clearForm() {
    this._redirect_to = null;
    this._redirect_to_on_signup = null;
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
            ${(
              [
                "redirect_to_on_signup",
              ] as const
            )
              .map((name) => {
                const val = this.getConfigValue(name);
                return val ? `${name} := ${JSON.stringify(val)}` : null;
              })
              .filter((l) => l)
              .join(",\n")}
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

@model("AdminDraftSMTPConfig")
export class DraftSMTPConfig extends Model({
  _sender: prop<string | null>(null),
  _host: prop<string | null>(null),
  _port: prop<string | null>(null),
  _username: prop<string | null>(null),
  _password: prop<string | null>(null),
  _security: prop<SMTPSecurity | null>(null),
  _validate_certs: prop<boolean | null>(null),
  _timeout_per_email: prop<string | null>(null),
  _timeout_per_attempt: prop<string | null>(null),
}) {
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

@model("DraftProviderConfig")
export class DraftProviderConfig extends Model({
  selectedProviderType: prop<ProviderTypename>().withSetter(),

  oauthClientId: prop("").withSetter(),
  oauthSecret: prop("").withSetter(),
  additionalScope: prop("").withSetter(),

  requireEmailVerification: prop(true).withSetter(),
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
  get formValid(): boolean {
    switch (providers[this.selectedProviderType].kind) {
      case "OAuth":
        return !this.oauthClientIdError && !this.oauthSecretError;
      case "Local":
        return true;
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
      const provider = providers[this.selectedProviderType];

      await conn.execute(
        `configure current database
          insert ${this.selectedProviderType} {
            ${
              provider.kind === "OAuth"
                ? `
            client_id := ${JSON.stringify(this.oauthClientId)},
            secret := ${JSON.stringify(this.oauthSecret)},
            ${
              this.additionalScope.trim()
                ? `additional_scope := ${JSON.stringify(
                    this.additionalScope.trim()
                  )}`
                : ""
            }
            `
                : provider.kind === "Local"
                ? `require_verification := ${
                    this.requireEmailVerification ? "true" : "false"
                  },`
                : ""
            }
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

function createDraftAuthConfig(
  name: string,
  type: string,
  validate: (val: string | null) => string | null,
  transform: (val: string | null) => string = JSON.stringify
) {
  @model(`DraftAuthConfig/${name}`)
  class DraftAuthConfig extends Model({
    value: prop<string | null>(null).withSetter(),
  }) {
    @computed
    get error() {
      return validate(this.value);
    }

    @observable
    updating = false;

    @action
    async update() {
      if (this.value == null || this.error) return;

      const conn = connCtx.get(this)!;
      const state = getParent<AuthAdminState>(this)!;

      this.updating = true;

      try {
        await conn.execute(
          `
    configure current database set
      ext::auth::AuthConfig::${name} := <${type}>${transform(this.value)}`
        );
        await state.refreshConfig();
        this.setValue(null);
      } finally {
        runInAction(() => (this.updating = false));
      }
    }
  }

  return prop(() => new DraftAuthConfig({}));
}
