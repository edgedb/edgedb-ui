import React from "react";
import {App} from "./models/app";

export const appContext = React.createContext<App | null>(null);

export const useAppState = () => {
  const state = React.useContext(appContext);
  if (!state) {
    throw new Error("useAppState must be used within a Provider.");
  }
  return state;
};
