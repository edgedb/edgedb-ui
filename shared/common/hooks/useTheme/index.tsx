"use client";

import {
  createContext,
  PropsWithChildren,
  useState,
  useContext,
  useLayoutEffect,
} from "react";

export enum Theme {
  light = "light",
  dark = "dark",
  system = "system",
}

const themeContext = createContext<
  [Theme, Theme.light | Theme.dark, (val: Theme) => void]
>(null!);

export function ThemeProvider({
  children,
  localStorageKey,
  forceTheme,
}: PropsWithChildren<{
  localStorageKey?: string;
  forceTheme?: Theme.light | Theme.dark;
}>) {
  if (typeof window === "undefined") {
    return (
      <div
        className="light-theme"
        style={{
          display: "contents",
        }}
      >
        {children}
      </div>
    );
  }

  const prefersDarkTheme = window.matchMedia("(prefers-color-scheme: dark)");

  const [theme, setTheme] = useState<Theme>(() => {
    if (forceTheme) {
      return forceTheme;
    }
    const theme = localStorage.getItem(localStorageKey ?? "appTheme");
    return theme === "light" || theme === "dark" || theme === "system"
      ? (theme as Theme)
      : Theme.system;
  });
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    theme === Theme.system
      ? prefersDarkTheme.matches
        ? Theme.dark
        : Theme.light
      : theme
  );

  useLayoutEffect(() => {
    if (theme === Theme.system) {
      const listener = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? Theme.dark : Theme.light);
      };
      prefersDarkTheme.addEventListener("change", listener);
      return () => {
        prefersDarkTheme.removeEventListener("change", listener);
      };
    }
  }, [theme]);

  return (
    <div
      className={
        (forceTheme ?? resolvedTheme) === Theme.light
          ? "light-theme"
          : "dark-theme"
      }
      style={{
        display: "contents",
      }}
    >
      <themeContext.Provider
        value={[
          forceTheme ?? theme,
          forceTheme ?? resolvedTheme,
          (theme) => {
            localStorage.setItem(localStorageKey ?? "appTheme", theme);
            setTheme(theme);
            setResolvedTheme(
              theme === Theme.system
                ? prefersDarkTheme.matches
                  ? Theme.dark
                  : Theme.light
                : theme
            );
          },
        ]}
      >
        {children}
      </themeContext.Provider>
    </div>
  );
}

export function useTheme() {
  return useContext(themeContext);
}
