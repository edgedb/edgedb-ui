import {Duration} from "edgedb";
import {action, computed, observable, runInAction} from "mobx";
import {
  getParent,
  Model,
  model,
  modelAction,
  objectActions,
  prop,
} from "mobx-keystone";
import {parsers} from "../../../components/dataEditor";
import {connCtx, dbCtx} from "../../../state";
import {AppleIcon, AzureIcon, GithubIcon, GoogleIcon} from "../icons";

export interface AuthConfigData {
  signing_key_exists: boolean;
  token_time_to_live: Duration;
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
  app_name: string | null;
  logo_url: string | null;
  dark_logo_url: string | null;
  brand_color: string | null;
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
  selectedTab: prop<"config">("config").withSetter(),

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
      try {
        parsers["std::duration"](dur, null);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    }
  ),

  draftProviderConfig: prop<DraftProviderConfig | null>(null),
  draftUIConfig: prop<DraftUIConfig | null>(null),
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

  async refreshConfig() {
    const conn = connCtx.get(this)!;

    const {result} = await conn.query(
      `with module ext::auth
      select cfg::Config.extensions[is AuthConfig] {
        signing_key_exists := signing_key_exists(),
        token_time_to_live,
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
          app_name,
          logo_url,
          dark_logo_url,
          brand_color,
        }
      }`,
      undefined,
      {ignoreSessionConfig: true}
    );

    if (result === null) return;

    const data = result[0];

    runInAction(() => {
      this.configData = {
        signing_key_exists: data.signing_key_exists,
        token_time_to_live: data.token_time_to_live,
      };
      this.providers = data.providers;
      this.uiConfig = data.ui ?? false;
      if (data.ui) {
        this.enableUI();
      }
    });
  }
}

@model("AdminDraftUIConfig")
export class DraftUIConfig extends Model({
  _redirect_to: prop<string | null>(null),
  _redirect_to_on_signup: prop<string | null>(null),
  _app_name: prop<string | null>(null),
  _logo_url: prop<string | null>(null),
  _dark_logo_url: prop<string | null>(null),
  _brand_color: prop<string | null>(null),

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
      this._app_name != null ||
      this._logo_url != null ||
      this._dark_logo_url != null ||
      this._brand_color != null
    );
  }

  @modelAction
  clearForm() {
    this._redirect_to = null;
    this._redirect_to_on_signup = null;
    this._app_name = null;
    this._logo_url = null;
    this._dark_logo_url = null;
    this._brand_color = null;
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
                "app_name",
                "logo_url",
                "dark_logo_url",
                "brand_color",
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
  validate: (val: string | null) => string | null
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
      ext::auth::AuthConfig::${name} := <${type}>${JSON.stringify(this.value)}`
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
