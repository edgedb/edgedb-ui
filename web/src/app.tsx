import {observer} from "mobx-react";
import {BrowserRouter, Route, Routes} from "react-router-dom";

import cn from "@edgedb/common/utils/classNames";

import "./fonts/include.scss";
import styles from "./app.module.scss";

import appState from "./state/store";
import {appContext} from "./state/providers";

import {
  GlobalDragCursorProvider,
  useGlobalDragCursor,
} from "@edgedb/common/hooks/globalDragCursor";
import {ThemeProvider} from "@edgedb/common/hooks/useTheme";
import {ModalProvider} from "@edgedb/common/hooks/useModal";

import Header from "src/components/header";
import Main from "src/components/main";
import LoginPage from "src/components/loginPage";

function App() {
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
    <BrowserRouter basename="ui">
      <div className={styles.theme}>
        <ModalProvider>
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
            <Routes>
              <Route path="_login" element={<LoginPage />} />
              <Route
                path="*"
                element={
                  <>
                    <Header />
                    <Main />
                  </>
                }
              />
            </Routes>
          </div>
        </ModalProvider>
      </div>
    </BrowserRouter>
  );
});

export default App;
