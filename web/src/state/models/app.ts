import {createContext, Model, model, prop} from "mobx-keystone";

import {InstanceState} from "@edgedb/studio/state/instance";

export const serverUrl =
  process.env.NODE_ENV === "development"
    ? process.env.REACT_APP_EDGEDB_SERVER
      ? `http://${process.env.REACT_APP_EDGEDB_SERVER}`
      : "http://localhost:5656"
    : window.location.origin;

const url = new URL(window.location.toString());

let authToken: string | null = null;
if (url.searchParams.has("authToken")) {
  authToken = url.searchParams.get("authToken")!;
  localStorage.setItem("edgedbAuthToken", authToken);

  url.searchParams.delete("authToken");
  window.history.replaceState(window.history.state, "", url);
} else {
  authToken = localStorage.getItem("edgedbAuthToken");
}

if (!authToken) {
  url.pathname = "/ui/_login";
  window.history.replaceState(null, "", url);
}

export function setAuthToken(token: string) {
  localStorage.setItem("edgedbAuthToken", token);
  window.history.replaceState(null, "", "/ui");
  window.location.reload();
}

export const appCtx = createContext<App>();

@model("App")
export class App extends Model({
  instanceState: prop(() => new InstanceState({serverUrl, authToken})),
}) {
  onInit() {
    appCtx.set(this, this);
  }
}
