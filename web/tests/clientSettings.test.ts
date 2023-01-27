import {ByUIClass, goToPage, uiClass} from "./_utils";

test("implicit limit 10", async () => {
  await goToPage("edgedb/editor");

  // Open client settings bar
  await driver.findElement(ByUIClass("sessionState_stateButton")).click();

  // Wait until schema loaded and open panel button available
  const openPanelButton = driver.wait(
    until.elementLocated(ByUIClass("sessionState_openPanel"))
  );
  await openPanelButton.click();

  // Set implicit limit to 10
  await driver
    .findElement(
      By.css(
        `${uiClass("sessionState_group")}:nth-child(3) ${uiClass(
          "sessionState_item"
        )} input`
      )
    )
    .sendKeys(Key.chord(Key.CONTROL, "a"), "10");

  // Close panel
  await driver.findElement(ByUIClass("sessionState_closePanel")).click();

  // Run query with >10 results
  const editor = await driver.findElement(By.className("cm-content"));
  await editor.sendKeys(
    "select range_unpack(range(1, 50))",
    Key.chord(Key.CONTROL, Key.ENTER)
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
