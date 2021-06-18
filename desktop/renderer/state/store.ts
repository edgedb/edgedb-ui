import {registerRootStore, getSnapshot, fromSnapshot} from "mobx-keystone";
import {App} from "./models";

let appState: App | null = null;

try {
  const savedState = localStorage.getItem("appState");
  if (savedState) {
    const snapshot = JSON.parse(savedState);
    appState = fromSnapshot<App>(snapshot);
  }
} catch (e) {
  console.error(e);
} finally {
  if (!appState) {
    appState = new App({});
  }
}

registerRootStore(appState);

export default appState!;

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    localStorage.setItem("appState", JSON.stringify(getSnapshot(appState)));
  }
});
