import {
  ByUIClass,
  goToPage,
  uiClass,
  waitUntilElementNotLocated,
} from "./_utils";

describe("dataViewer:", () => {
  test("insert new Account", async () => {
    await goToPage("_test/data/default::Account");

    // Wait until schema and data loaded
    await driver.wait(
      until.elementLocated(ByUIClass("dataInspector_cellWrapper"))
    );

    const itemsCountEl = await driver.findElement(
      ByUIClass("dataview_rowCount")
    );

    const initialItemsCount = Number.parseInt(
      await itemsCountEl.getText(),
      10
    );

    // click insert button
    await driver.findElement(ByUIClass("dataview_headerButton")).click();

    // Enter new username
    const usernameField = await driver.findElement(
      By.css(
        `${uiClass("dataInspector_editableCell")}${uiClass(
          "dataInspector_hasErrors"
        )}`
      )
    );
    await driver.actions({async: true}).doubleClick(usernameField).perform();

    await driver
      .findElement(By.css(`${uiClass("dataEditor_dataEditor")} textarea`))
      .sendKeys("Test Account", Key.chord(Key.CONTROL, Key.ENTER));

    // Apply changes
    await driver.findElement(ByUIClass("dataview_reviewChanges")).click();

    await driver.findElement(ByUIClass("editsModal_greenButton")).click();

    // Wait for data refresh
    await waitUntilElementNotLocated(ByUIClass("modal_modalOverlay"));

    const newItemsCount = Number.parseInt(await itemsCountEl.getText(), 10);

    expect(newItemsCount).toBe(initialItemsCount + 1);
  });
});
