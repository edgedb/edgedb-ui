import {createClient} from "edgedb";
import type {Locator, WebElement} from "selenium-webdriver";

export const client = createClient({port: 5656, tlsSecurity: "insecure"});

export function goToPage(url: string) {
  return driver.get(`http://localhost:3002/ui/${url}`);
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

export async function waitUntilElementsContentHasChanged(
  element: WebElement,
  initialContent: string | string[],
  waitDuration: number
) {
  const initial =
    typeof initialContent === "string" ? [initialContent] : initialContent;
  return driver.wait(async () => {
    const content = await element.getText();
    return !initial.includes(content);
  }, waitDuration);
}

export const cmdCtrl = process.platform.toLowerCase().includes("darwin")
  ? Key.COMMAND
  : Key.CONTROL;
