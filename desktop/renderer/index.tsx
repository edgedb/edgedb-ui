import ReactDOM from "react-dom";

import {sysInfo} from "./global";

import App from "./app";

import "./styles.scss";

const render = () => {
  ReactDOM.render(<App />, document.getElementById("root"));
};

render();

if (sysInfo.isDev && module.hot) {
  module.hot.accept("./app", render);
}
