import {createContext, Model, model, prop} from "mobx-keystone";

import {InstanceState} from "@edgedb/studio/state/instance";

export const serverUrl = import.meta.env.DEV
  ? import.meta.env.VITE_GEL_SERVER_URL
    ? `http://${import.meta.env.VITE_GEL_SERVER_URL}`
    : "http://localhost:5656"
  : window.location.origin;

const url = new URL(window.location.toString());

const TOKEN_KEY = "edgedbAuthToken";
const USERNAME_KEY = "edgedbAuthUsername";

let authToken: string | null = null;
let authUsername: string | null = null;

if (url.searchParams.has("authToken")) {
  authToken = url.searchParams.get("authToken")!;
  localStorage.setItem(TOKEN_KEY, authToken);
  localStorage.removeItem(USERNAME_KEY);

  url.searchParams.delete("authToken");
  window.history.replaceState(window.history.state, "", url);
} else {
  authToken = localStorage.getItem(TOKEN_KEY);
  authUsername = localStorage.getItem(USERNAME_KEY);
}

if (!authToken) {
  url.pathname = "/ui/_login";
  window.history.replaceState(null, "", url);
}

export function setAuthToken(username: string, token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
  window.location.replace("/ui");
}

function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  if (window.location.pathname !== "/ui/_login") {
    window.location.assign("/ui/_login");
  }
}

export const appCtx = createContext<App>();

@model("App")
export class App extends Model({
  instanceState: prop(
    () =>
      new InstanceState({
        serverUrl,
        authToken,
        authUsername,
      })
  ),
}) {
  onInit() {
    this.instanceState.fetchInstanceInfo();
    this.instanceState._refreshAuthToken = clearAuthToken;
    appCtx.set(this, this);
  }
}
