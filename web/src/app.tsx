import {useEffect} from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import "./fonts/include.scss";
import styles from "./app.module.scss";

import {highlightStyle} from "@edgedb/code-editor/theme";
import {StyleModule} from "style-mod";

import appState from "./state/store";
import {appContext} from "./state/providers";

import {
  GlobalDragCursorProvider,
  useGlobalDragCursor,
} from "./hooks/globalDragCursor";

import ThemeProvider from "./ui/themeProvider";

import Header from "src/components/header";
import Main from "src/components/main";

function App() {
  useEffect(() => {
    if (highlightStyle.module) {
      StyleModule.mount(document, highlightStyle.module);
    }
  }, []);

  return (
    <appContext.Provider value={appState}>
      <ThemeProvider>
        <GlobalDragCursorProvider>
          <AppMain />
        </GlobalDragCursorProvider>
      </ThemeProvider>
    </appContext.Provider>
  );
}

const AppMain = observer(function _AppMain() {
  const [globalDragCursor] = useGlobalDragCursor();

  return (
    <>
      <div
        className={cn(styles.app, {
          [styles.globalDragCursor]: !!globalDragCursor,
        })}
        style={
          {"--drag-cursor": globalDragCursor || undefined} as {
            [key: string]: string;
          }
        }
      >
        <Header />
        <Main />
      </div>
      {appState.modalOverlay}
    </>
  );
});

export default App;
