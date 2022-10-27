import {fromSnapshot, Model, model, onSnapshot, prop} from "mobx-keystone";

@model("Settings")
export class Settings extends Model({
  disableAccessPolicies: prop<boolean>(false).withSetter(),
  persistQuery: prop<boolean>(false).withSetter(),
}) {}

const localStorageKey = "edgedbStudioSettings";

let settingsState: Settings;
const storedSettings = localStorage.getItem(localStorageKey);
if (storedSettings) {
  try {
    settingsState = fromSnapshot(Settings, JSON.parse(storedSettings));
  } catch {
    // ignore deserialisation errors
  }
}
if (!settingsState!) {
  settingsState = new Settings({});
}

export {settingsState};

onSnapshot(settingsState, (snapshot) => {
  localStorage.setItem(localStorageKey, JSON.stringify(snapshot));
});
