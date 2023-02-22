import type {WebDriver} from "selenium-webdriver";

declare global {
  const driver: WebDriver;
  export {driver};

  export {
    until,
    By,
    Key,
    Condition,
    error as SeleniumError,
  } from "selenium-webdriver";
}
