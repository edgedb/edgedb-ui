import "@fontsource-variable/roboto-flex";

import cn from "@edgedb/common/utils/classNames";

import {
  AuthProviderData,
  DraftAppConfig,
  providers as providersInfo,
} from "./state";

import styles from "./loginuipreview.module.scss";
import {getColourVariables, normaliseHexColor} from "./colourUtils";

export function LoginUIPreview({
  draft,
  providers,
  darkTheme,
}: {
  draft: DraftAppConfig;
  providers: AuthProviderData[];
  darkTheme: boolean;
}) {
  const appName = draft.getConfigValue("app_name");
  const brandColor = draft.getConfigValue("brand_color") || "1f8aed";
  const logoUrl = draft.getConfigValue("logo_url");
  const darkLogoUrl = draft.getConfigValue("dark_logo_url");

  const colorVariables = getColourVariables(normaliseHexColor(brandColor));

  const hasPasswordProvider = providers.some(
    (p) => p.name === "builtin::local_emailpassword"
  );

  const oauthButtons = providers
    .filter((provider) => providersInfo[provider._typename].kind === "OAuth")
    .map((provider) => (
      <a key={provider.name}>
        {providersInfo[provider._typename].icon}
        <span>
          Sign in with {providersInfo[provider._typename].displayName}
        </span>
      </a>
    ));

  return (
    <div
      className={cn(
        styles.previewPage,
        darkTheme ? "dark-theme" : "light-theme",
        {
          [styles.darkTheme]: darkTheme,
        }
      )}
      style={colorVariables as any}
    >
      {logoUrl ? (
        <picture className={styles.brandLogo}>
          <img src={darkTheme ? darkLogoUrl || logoUrl : logoUrl} />
        </picture>
      ) : null}
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <h1>
          {appName ? (
            <>
              <span>Sign in to</span> {appName}
            </>
          ) : (
            <span>Sign in</span>
          )}
        </h1>

        <div className={styles.oauthButtons}>{oauthButtons}</div>

        {hasPasswordProvider && oauthButtons.length ? (
          <div className={styles.divider}>
            <span>or</span>
          </div>
        ) : null}

        {hasPasswordProvider ? (
          <>
            <label htmlFor="preview_email">Email</label>
            <input id="preview_email" name="email" type="email" />

            <div className={styles.fieldHeader}>
              <label htmlFor="preview_password">Password</label>
              <a id="forgot-password-link" className={styles.fieldNote}>
                Forgot password?
              </a>
            </div>
            <input id="preview_password" name="password" type="password" />

            <button>
              <span>Sign In</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="25"
                viewBox="0 0 24 25"
                fill="none"
              >
                <path
                  d="M5 12.5H19"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 5.5L19 12.5L12 19.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className={styles.bottomNote}>
              Don't have an account? <a>Sign up</a>
            </div>
          </>
        ) : null}
      </form>
    </div>
  );
}
