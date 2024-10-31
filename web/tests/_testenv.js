import {TestEnvironment as NodeEnvironment} from "jest-environment-node";

import {Builder, Browser, By, until, Key, error} from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

let opts = new chrome.Options();

if (process.env["CI"] || !process.argv.slice(2).includes("--no-headless")) {
  opts.addArguments("--headless=new");
}

class SeleniumEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();

    const driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(opts)
      .build();

    try {
      await driver.get("http://localhost:3002/ui?authToken=test");
    } catch (err) {
      driver.quit();
      throw err;
    }

    this.global.driver = driver;

    this.global.By = By;
    this.global.until = until;
    this.global.Key = Key;
    this.global.SeleniumError = error;
  }

  async teardown() {
    if (this.global.driver) {
      await this.global.driver.quit();
    }

    await super.teardown();
  }
}

export default SeleniumEnvironment;
