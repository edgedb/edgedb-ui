import React from "react";
import "mobx-react-lite/batchingForReactDom";
import {observer} from "mobx-react";

import "normalize.css";
import styles from "./app.module.scss";

import {sysInfo} from "./global";

import appState from "./state/store";
import {appContext} from "./state/providers";

import cn from "@edgedb/common/utils/classNames";
import ThemeProvider from "./ui/themeProvider";

import {CodeHighlightingContext} from "@edgedb/common/hooks/useCodeHighlighting";
import monaco from "./monaco";

import TabBar from "./components/tabBar";
import Main from "./components/main";
import WindowsControls from "./components/windowsControls";

const highlight = (code: string) => monaco.editor.colorize(code, "edgeql", {});

export default observer(function App() {
  return (
    <React.StrictMode>
      <CodeHighlightingContext.Provider
        value={{
          highlight,
        }}
      >
        <appContext.Provider value={appState}>
          <ThemeProvider>
            <div
              className={cn(
                styles.app,
                appState.globalDragCursor ? styles.globalDragCursor : null
              )}
              style={
                {"--drag-cursor": appState.globalDragCursor || undefined} as {
                  [key: string]: string;
                }
              }
            >
              <TabBar />
              <Main />
            </div>
            {appState.modalOverlay}
            <div id="modalPortalTarget" />
            <div id="popupMenuPortalTarget" />
          </ThemeProvider>
        </appContext.Provider>
      </CodeHighlightingContext.Provider>
      {sysInfo.platform === "win32" ? <WindowsControls /> : null}
    </React.StrictMode>
  );
});
