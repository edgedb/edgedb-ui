import {registerRootStore} from "mobx-keystone";
import {App} from "./models/app";

let appState: App | null = null;

appState = new App({});

registerRootStore(appState);

export default appState!;
