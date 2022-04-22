import {createContext, PropsWithChildren, useState, useContext} from "react";

export enum Theme {
  light = "light",
  dark = "dark",
}

const themeContext = createContext<[Theme, (val: Theme) => void]>(null!);

export function ThemeProvider({
  children,
  localStorageKey,
}: PropsWithChildren<{localStorageKey?: string}>) {
  const state = useState<Theme>(() => {
    const theme = localStorage.getItem(localStorageKey ?? "appTheme");
    return theme === "light" || theme === "dark"
      ? (theme as Theme)
      : Theme.light;
  });

  return (
    <div
      className={state[0] === Theme.light ? "light-theme" : "dark-theme"}
      style={{
        display: "contents",
      }}
    >
      <themeContext.Provider value={state}>{children}</themeContext.Provider>
    </div>
  );
}

export function useTheme() {
  return useContext(themeContext);
}
