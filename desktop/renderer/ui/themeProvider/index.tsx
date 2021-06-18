import React from "react";
import {observer} from "mobx-react";

import {useAppState} from "../../state/providers";

import "../../themes.module.scss";

import {tokenColours as darkTokenColours} from "../../monaco/themes/EdgeDBDark";
import {tokenColours as lightTokenColours} from "../../monaco/themes/EdgeDBLight";
import {Theme} from "../../state/models/app";

export default observer(function ThemeProvider(
  props: React.PropsWithChildren<unknown>
) {
  const appState = useAppState();

  const themeStyle =
    appState.theme === Theme.light ? "light-theme" : "dark-theme";

  const textColours = (appState.theme === Theme.light
    ? lightTokenColours
    : darkTokenColours
  ).reduce((colours, token) => {
    colours["--text-theme-" + token.token.replace(/\./g, "-")] =
      token.foreground;
    return colours;
  }, {} as {[key: string]: string});

  return (
    <div
      className={themeStyle}
      style={{
        ...textColours,
        display: "contents",
      }}
    >
      {props.children}
    </div>
  );
});
