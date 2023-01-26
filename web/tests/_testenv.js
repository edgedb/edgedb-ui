const NodeEnvironment = require("jest-environment-node").TestEnvironment;

const {Builder, By, until} = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

let opts = new chrome.Options();

if (process.env["CI"] || !process.argv.slice(2).includes("--no-headless")) {
  opts = opts.headless();
}

class SeleniumEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();

    const driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(opts)
      .build();

    try {
      await driver.get("http://localhost:3000/ui?authToken=test");
    } catch (err) {
      driver.quit();
      throw err;
    }

    this.global.driver = driver;
    this.global.By = By;
    this.global.until = until;
  }

  async teardown() {
    if (this.global.driver) {
      await this.global.driver.quit();
    }

    await super.teardown();
  }
}

module.exports = SeleniumEnvironment;
