import React from "react";
import {App, Tab} from "./models";

export const appContext = React.createContext<App | null>(null);

export const useAppState = () => {
  const state = React.useContext(appContext);
  if (!state) {
    throw new Error("useAppState must be used within a Provider.");
  }
  return state;
};

export const tabContext = React.createContext<Tab | null>(null);

export const useTabState = () => {
  const state = React.useContext(tabContext);
  if (!state) {
    throw new Error("useTabState must be used within a Provider.");
  }
  return state;
};
