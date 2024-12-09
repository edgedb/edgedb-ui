import {ByUIClass, goToPage, waitUntilElementNotLocated} from "./_utils";

describe("queryEditor:", () => {
  beforeAll(async () => {
    await goToPage("_test/editor");

    // wait until schema and data loaded
    await driver.wait(
      until.elementLocated(ByUIClass("codeEditor_codeEditor"))
    );
  });

  describe("editor", () => {
    test("enter invalid query: InvalidReferenceError", async () => {
      driver.navigate().refresh();

      const editor = await driver.wait(
        until.elementLocated(By.className("cm-content"))
      );

      await editor.sendKeys(
        "select Movie { title } filter .releaseyear = 2015"
      );

      // run the query
      const runButton = await driver.findElement(
        ByUIClass("queryeditor_runBtn")
      );
      await runButton.click();

      const errorElement = await driver.wait(
        until.elementLocated(ByUIClass("queryeditor_queryError"))
      );

      const error = await errorElement.findElement(
        ByUIClass("queryeditor_errorName")
      );

      expect((await error.getText()).includes("InvalidReferenceError")).toBe(
        true
      );

      const errorHint = await errorElement.findElement(
        ByUIClass("queryeditor_errorHint")
      );

      expect(await errorHint.getText()).toBe(
        "Hint: did you mean 'release_year'?"
      );
    });

    test("enter invalid query: EdgeQLSyntaxError", async () => {
      driver.navigate().refresh();

      const editor = await driver.wait(
        until.elementLocated(By.className("cm-content"))
      );

      await editor.sendKeys(
        "select Movie { title } filter .releaseyear = 2015)"
      );

      // run the query
      const runButton = await driver.findElement(
        ByUIClass("queryeditor_runBtn")
      );
      await runButton.click();

      const errorElement = await driver.wait(
        until.elementLocated(ByUIClass("queryeditor_queryError"))
      );

      const error = await errorElement.findElement(
        ByUIClass("queryeditor_errorName")
      );

      expect((await error.getText()).includes("EdgeQLSyntaxError")).toBe(true);
    });

    test("enter valid query, get results, copy and view them", async () => {
      driver.navigate().refresh();

      const editor = await driver.wait(
        until.elementLocated(By.className("cm-content"))
      );

      await editor.sendKeys(
        "select Movie { title } filter .release_year = 2015"
      );

      // run the query
      const runButton = await driver.findElement(
        ByUIClass("queryeditor_runBtn")
      );
      await runButton.click();

      const inspector = await driver.wait(
        until.elementLocated(ByUIClass("queryeditor_inspector"))
      );

      const results = await inspector.findElements(
        ByUIClass("inspector_scalar_string")
      );

      expect(await results[0].getText()).toBe("Ant-Man");
      expect(await results[1].getText()).toBe("Avengers: Age of Ultron");

      // there should be copy buttons for the whole result and for all its parts
      const copyButtons = await inspector.findElements(
        ByUIClass("inspector_copyButton")
      );

      // there should be copy options for the whole result and every result's parts and their parts
      expect(copyButtons.length).toBe(5);
      expect(await copyButtons[0].getAttribute("innerText")).toBe("COPY");

      // copy the whole result to the clipboard
      await copyButtons[0].click();
      expect(await copyButtons[0].getAttribute("innerText")).toBe("COPIED");

      // when clicking on view button, new window is opened
      const viewButtons = await inspector.findElements(
        ByUIClass("inspector_viewButton")
      );

      expect(await viewButtons[0].getAttribute("innerText")).toBe(" VIEW");

      await viewButtons[0].click();

      // wait for the view window to open
      const viewWindow = await driver.wait(
        until.elementLocated(ByUIClass("queryeditor_extendedViewerContainer"))
      );

      // linewrap / show whitespace
      const actionButtons = await viewWindow.findElements(
        ByUIClass("shared_actionButton")
      );

      expect(await actionButtons.length).toBe(2);
      expect(await actionButtons[0].getAttribute("innerText")).toBe(
        "LINEWRAP"
      );
      expect(await actionButtons[1].getAttribute("innerText")).toBe(
        "SHOW WHITESPACE"
      );

      (await viewWindow.findElement(ByUIClass("shared_closeAction"))).click();

      await waitUntilElementNotLocated(
        ByUIClass("queryeditor_extendedViewerContainer")
      );
    });

    test("open history and choose item to edit", async () => {
      // firstly run some query to be sure there's something in the history
      const editor = await driver.findElement(By.className("cm-content"));
      await editor.clear();

      await editor.sendKeys("select 1 + 1");

      // run the query and populate the history
      const runButton = await driver.findElement(
        ByUIClass("queryeditor_runBtn")
      );
      await runButton.click();

      // write something else in the editor
      await editor.clear();
      await editor.sendKeys("select 2 + 2");

      // save the current editor text to be able to compare it later with the other one from history
      const draftQuery = await editor.getText();

      (
        await driver.findElement(ByUIClass("queryeditor_historyButton"))
      ).click();

      await driver.wait(
        until.elementLocated(ByUIClass("queryeditor_history"))
      );
      // the element get rerendered and we need to get it again in order to avoid stale reference err
      await driver.wait(
        until.elementLocated(ByUIClass("queryeditor_history"))
      );

      // click on first history query (that is not draft query)
      const firstItem = await driver.findElements(
        ByUIClass("queryeditor_historyItem")
      );
      await firstItem[1].click();
      // click on edit button
      (
        await driver.wait(
          until.elementLocated(ByUIClass("queryeditor_loadButton")),
          2000
        )
      ).click();

      expect(await editor.getText()).not.toBe(draftQuery);

      // history sidebar is closed
      await waitUntilElementNotLocated(ByUIClass("queryeditor_history"));
    });
  });

  describe("builder", () => {
    beforeAll(async () => {
      const editorTabs = await driver.wait(
        until.elementLocated(ByUIClass("queryeditor_tabs"))
      );

      const tabs = await editorTabs.findElements(ByUIClass("queryeditor_tab"));
      // click on builder tab
      await driver.actions({async: true}).click(tabs[1]).perform();
      // wait for builder window to show
      await driver.wait(
        until.elementLocated(ByUIClass("queryBuilder_queryBuilder"))
      );
    });

    test("queryBuilder renders correctly", async () => {
      const container = await driver.findElement(
        ByUIClass("queryBuilder_queryBuilder")
      );

      // select keyword should be shown
      const selectKeyword = await container.findElement(
        ByUIClass("queryBuilder_keyword")
      );
      expect(await selectKeyword.getText()).toBe("select");
      // select dropdown with all existing db objects should be shown
      await container.findElement(ByUIClass("queryBuilder_select"));
      // id checkbox should exists
      const checkboxes = await container.findElements(
        ByUIClass("queryBuilder_inactive")
      );
      expect(checkboxes.length).toBe(3);
      // 4 query modifiers should be visible
      const modButtons = await container.findElements(
        ByUIClass("queryBuilder_modButton")
      );
      expect(modButtons.length).toBe(4);
      expect(await modButtons[0].getText()).toBe("filter");
      expect(await modButtons[1].getText()).toBe("order by");
      expect(await modButtons[2].getText()).toBe("offset");
      expect(await modButtons[3].getText()).toBe("limit");
    });
  });
});
