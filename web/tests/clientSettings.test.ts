import {ByUIClass, goToPage, uiClass, cmdCtrl} from "./_utils";

describe("clientSettings:", () => {
  beforeAll(async () => {
    await goToPage("_test/editor");

    // open client settings bar
    await driver.findElement(ByUIClass("sessionState_stateButton")).click();
  });

  test("change implicit limit to 10 and show up to 10 results", async () => {
    // wait until schema loaded and open panel button available
    const openPanelButton = driver.wait(
      until.elementLocated(ByUIClass("sessionState_openPanel"))
    );
    await openPanelButton.click();

    // set implicit limit to 10
    await driver
      .findElement(
        By.css(
          `${uiClass("sessionState_group")}:nth-child(3) ${uiClass(
            "sessionState_item"
          )} input`
        )
      )
      .sendKeys(Key.chord(cmdCtrl, "a"), "10");

    // close panel
    await driver.findElement(ByUIClass("sessionState_closePanel")).click();

    // run query with >10 results
    const editor = await driver.findElement(By.className("cm-content"));
    await editor.sendKeys(
      "select range_unpack(range(1, 50))",
      Key.chord(cmdCtrl, Key.ENTER)
    );

    const resultHiddenNote = driver.wait(
      until.elementLocated(
        ByUIClass("repl_queryResult", "inspector_resultsHidden")
      )
    );
    expect(
      (await resultHiddenNote.getText()).includes("further results hidden")
    ).toBe(true);

    // check only 10 results returned
    const results = await driver.findElements(
      ByUIClass("repl_queryResult", "inspector_scalar_number")
    );
    expect(results.length).toBe(10);
  });

  test(`remove settings and show "no configured settings" in  the client settings' topbar`, async () => {
    // show Implicit Limit := 10 inside client settings' topbar
    const sessionStateElement = driver.wait(
      until.elementLocated(ByUIClass("sessionState_chip"))
    );

    const sessionStateElementValue = await sessionStateElement.findElement(
      ByUIClass("sessionState_chipVal")
    );

    expect(
      (await sessionStateElement.getText()).includes("Implicit Limit")
    ).toBe(true);

    expect(await sessionStateElementValue.getText()).toBe("10");

    // open the panel
    await driver.findElement(ByUIClass("sessionState_openPanel")).click();

    // remove the implicit limit setting
    await driver
      .findElement(
        By.css(
          `${uiClass("sessionState_group")}:nth-child(3) ${uiClass(
            "sessionState_item"
          )} ${uiClass("toggleSwitch_track")}`
        )
      )
      .click();

    // close panel
    await driver.findElement(ByUIClass("sessionState_closePanel")).click();

    const emptySessionElement = await driver.findElement(
      ByUIClass("sessionState_emptySessionBar")
    );

    // show "no configured settings" inside client settings' topbar
    expect(await emptySessionElement.getAttribute("innerText")).toBe(
      "no configured settings"
    );
  });

  test("add a setting and show correct elements in the the client settings' topbar", async () => {
    // open the panel
    await driver.findElement(ByUIClass("sessionState_openPanel")).click();

    // add the implicit limit setting
    const implicitLimitSettingElement = await driver.findElement(
      By.css(
        `${uiClass("sessionState_group")}:nth-child(3) ${uiClass(
          "sessionState_item"
        )}`
      )
    );

    await implicitLimitSettingElement
      .findElement(ByUIClass("toggleSwitch_track"))
      .click();

    await implicitLimitSettingElement
      .findElement(By.css("input"))
      .sendKeys(Key.chord(cmdCtrl, "a"), "20");

    // close panel
    await driver.findElement(ByUIClass("sessionState_closePanel")).click();

    const sessionStateElement = await driver.findElement(
      ByUIClass("sessionState_chip")
    );

    const sessionStateElementValue = await sessionStateElement.findElement(
      ByUIClass("sessionState_chipVal")
    );

    // show Implicit Limit := 20 inside client settings' topbar
    expect(
      (await sessionStateElement.getAttribute("innerText")).includes(
        "Implicit Limit"
      )
    ).toBe(true);

    expect(await sessionStateElementValue.getAttribute("innerText")).toBe(
      "20"
    );
  });
});
