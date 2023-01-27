import {createClient} from "edgedb";
import type {Locator} from "selenium-webdriver";

export const client = createClient({port: 5656, tlsSecurity: "insecure"});

export function goToPage(url: string) {
  return driver.get(`http://localhost:3000/ui/${url}`);
}

export function uiClass(className: string) {
  return `[class*=${className}__]`;
}

export function ByUIClass(...classNames: string[]) {
  return By.css(classNames.map(uiClass).join(" "));
}

export async function waitUntilElementNotLocated(locator: Locator) {
  while (true) {
    try {
      await driver.findElement(locator);
    } catch (err) {
      if (err instanceof SeleniumError.NoSuchElementError) {
        return;
      }
    }
  }
}
