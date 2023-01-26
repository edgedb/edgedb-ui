import type {WebDriver, until, By as _By} from "selenium-webdriver";

declare global {
  const driver: WebDriver;
  const until: until;
  class By extends _By {}
}
