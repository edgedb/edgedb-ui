import * as selenium from "selenium-webdriver";

declare global {
  const driver: selenium.WebDriver;

  const until: typeof selenium.until;
  const By: typeof selenium.By;
  const Key: typeof selenium.Key;
  const Condition: typeof selenium.Condition;
  const SeleniumError: typeof selenium.error;
}
