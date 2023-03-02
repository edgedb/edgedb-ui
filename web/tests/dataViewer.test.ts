import {
  ByUIClass,
  goToPage,
  uiClass,
  waitUntilElementNotLocated,
  waitUntilElementsContentHasChanged,
  cmdCtrl,
} from "./_utils";

describe("dataViewer:", () => {
  describe("Account:", () => {
    beforeAll(async () => {
      await goToPage("_test/data/default::Account");

      // wait until schema and data loaded
      await driver.wait(
        until.elementLocated(ByUIClass("dataInspector_cellWrapper"))
      );
    });

    test("insert new Account", async () => {
      const itemsCountEl = await driver.findElement(
        ByUIClass("dataview_rowCount")
      );
      const initialItemsCount = parseInt(await itemsCountEl.getText(), 10);
      // click insert button
      await driver.findElement(ByUIClass("dataview_headerButton")).click();
      // enter new username
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
        .sendKeys("Test Account", Key.chord(cmdCtrl, Key.ENTER));
      // apply changes
      await driver.findElement(ByUIClass("dataview_reviewChanges")).click();
      await driver.findElement(ByUIClass("editsModal_greenButton")).click();
      // wait for data refresh
      await waitUntilElementNotLocated(ByUIClass("modal_modalOverlay"));
      const newItemsCount = parseInt(await itemsCountEl.getText(), 10);
      expect(newItemsCount).toBe(initialItemsCount + 1);
    });

    test("delete an Account", async () => {
      const itemsCountEl = await driver.findElement(
        ByUIClass("dataview_rowCount")
      );

      const initialItemsCount = parseInt(await itemsCountEl.getText(), 10);

      const firstAccountUsername = await (
        await driver.findElement(ByUIClass("dataInspector_editableCell"))
      ).getText();

      // delete first account
      await driver
        .findElement(
          By.css(
            `${uiClass("dataInspector_rowIndex")} ${uiClass(
              "dataInspector_deleteRowAction"
            )}`
          )
        )
        .click();

      // apply changes
      await driver.findElement(ByUIClass("dataview_reviewChanges")).click();
      await driver.findElement(ByUIClass("editsModal_greenButton")).click();
      // wait for data refresh
      await waitUntilElementNotLocated(ByUIClass("modal_modalOverlay"));

      const newItemsCount = parseInt(await itemsCountEl.getText(), 10);
      expect(newItemsCount).toBe(initialItemsCount - 1);

      // assert that first account name is removed from the list
      const accountElements = await driver.findElements(
        ByUIClass("dataInspector_editableCell")
      );

      const accountNames = await Promise.all(
        accountElements.map(async (elem) => await elem.getText())
      );

      expect(accountNames.includes(firstAccountUsername)).toBe(false);
    });
  });

  describe("Movie:", () => {
    beforeAll(async () => {
      await goToPage("_test/data/default::Movie");

      // wait until schema and data loaded
      await driver.wait(
        until.elementLocated(ByUIClass("dataInspector_cellWrapper"))
      );
    });

    test("filter all movies that includes the specific actor and then clear the filter", async () => {
      const itemsCountEl = await driver.findElement(
        ByUIClass("dataview_rowCount")
      );
      const initialItemsCount = await itemsCountEl.getText();

      // click the filter button and open the textarea
      await driver.findElement(ByUIClass("dataview_filterButton")).click();

      await driver
        .findElement(By.className("cm-activeLine"))
        .sendKeys(".actors.name='Chris Evans'");

      // apply the filter
      const applyFilterButton = await driver.findElement(
        ByUIClass("dataview_applyFilterButton")
      );
      await applyFilterButton.click();

      // wait for rerender to finish
      await waitUntilElementsContentHasChanged(
        itemsCountEl,
        initialItemsCount,
        2000
      );

      const filteredElementsCount = await itemsCountEl.getText();
      expect(parseInt(filteredElementsCount)).toBeLessThan(
        parseInt(initialItemsCount)
      );

      // clear the filter
      await driver
        .findElement(ByUIClass("dataview_clearFilterButton"))
        .click();

      // wait for rerender to finish
      await waitUntilElementsContentHasChanged(
        itemsCountEl,
        filteredElementsCount,
        2000
      );

      const itemsCount = parseInt(await itemsCountEl.getText(), 10);
      expect(itemsCount).toBe(parseInt(initialItemsCount));
    });
  });
});
