import {observer} from "mobx-react";
import {BrowserRouter, Route, Routes} from "react-router-dom";

import "./fonts/include.scss";
import styles from "./app.module.scss";
import themeStyles from "@edgedb/common/newui/theme.module.scss";

import "@fontsource-variable/roboto-flex/index.css";
import "@fontsource-variable/roboto-mono/index.css";

import appState from "./state/store";
import {appContext} from "./state/providers";

import {GlobalDragCursorProvider} from "@edgedb/common/hooks/globalDragCursor";
import {ThemeProvider} from "@edgedb/common/hooks/useTheme";
import {ModalProvider} from "@edgedb/common/hooks/useModal";
import {HeaderNavProvider} from "@edgedb/studio/components/headerNav";
import {GlobalTooltipsProvider} from "@edgedb/common/hooks/useTooltips";

import {Header} from "./components/header";
import Main from "./components/main";
import LoginPage from "./components/loginPage";

function App() {
  return (
    <appContext.Provider value={appState}>
      <ThemeProvider>
        <GlobalDragCursorProvider>
          <GlobalTooltipsProvider>
            <HeaderNavProvider>
              <AppMain />
            </HeaderNavProvider>
          </GlobalTooltipsProvider>
        </GlobalDragCursorProvider>
      </ThemeProvider>
    </appContext.Provider>
  );
}

const AppMain = observer(function _AppMain() {
  return (
    <BrowserRouter basename="ui">
      <div className={`${styles.theme} ${themeStyles.theme}`}>
        <ModalProvider>
          <div className={styles.app}>
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
