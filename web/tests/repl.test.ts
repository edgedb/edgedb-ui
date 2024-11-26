import {ByUIClass, goToPage} from "./_utils";

describe("REPL:", () => {
  beforeAll(async () => {
    await goToPage("_test/repl");
  });

  test("check basic UI and click on \\help command", async () => {
    const header = await driver.wait(
      until.elementLocated(ByUIClass("repl_replHeader"))
    );

    const headerMessage = await header.findElement(
      ByUIClass("repl_headerMsg")
    );

    // click on \help
    (await headerMessage.findElement(By.css("span"))).click();

    const response = await driver.wait(
      until.elementLocated(ByUIClass("repl_replHistoryItem"))
    );

    expect(
      (
        await (
          await response.findElement(ByUIClass("repl_historyPrompt"))
        ).getAttribute("innerText")
      ).trim()
    ).toBe("_test[edgeql]>");
    expect(
      await (
        await response.findElement(ByUIClass("repl_code"))
      ).getAttribute("innerText")
    ).toBe("\\help");

    await response.findElement(ByUIClass("repl_historyTime"));
    await response.findElement(ByUIClass("repl_historyOutput"));
  });

  test("type query and check result", async () => {
    const replInput = await driver.findElement(ByUIClass("repl_replInput"));

    // type \l command
    (await replInput.findElement(By.className("cm-line"))).sendKeys(
      "\\l",
      Key.chord(Key.ENTER)
    );

    // implicit wait for the response to show (it has the same class as previous \help response)
    await driver.manage().setTimeouts({implicit: 10});

    const responses = await driver.findElements(
      ByUIClass("repl_replHistoryItem")
    );

    expect(
      await (await responses[1].findElement(ByUIClass("repl_code"))).getText()
    ).toBe("\\l");
  });
});
