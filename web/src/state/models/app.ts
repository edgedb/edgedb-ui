import {createContext, Model, model, prop} from "mobx-keystone";

import {InstanceState} from "@edgedb/studio/state/instance";

const serverUrl =
  process.env.NODE_ENV === "development"
    ? process.env.REACT_APP_EDGEDB_SERVER
      ? `http://${process.env.REACT_APP_EDGEDB_SERVER}`
      : "http://localhost:5656"
    : window.location.origin;

export const appCtx = createContext<App>();

@model("App")
export class App extends Model({
  instanceState: prop(() => new InstanceState({serverUrl})),
}) {
  onInit() {
    appCtx.set(this, this);
  }
}
