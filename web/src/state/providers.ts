import React from "react";
import {App} from "./models/app";
import {DatabasePageState} from "./models/database";

export const appContext = React.createContext<App | null>(null);

export const useAppState = () => {
  const state = React.useContext(appContext);
  if (!state) {
    throw new Error("useAppState must be used within a Provider.");
  }
  return state;
};

export const databaseContext = React.createContext<DatabasePageState | null>(
  null
);

export const useDatabaseState = () => {
  const state = React.useContext(databaseContext);
  if (!state) {
    throw new Error("useDatabaseState must be used within a Provider.");
  }
  return state;
};
