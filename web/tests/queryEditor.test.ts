import {
  ByUIClass,
  goToPage,
  waitUntilElementNotLocated,
  uiClass,
} from "./_utils";

describe("queryEditor:", () => {
  beforeAll(async () => {
    await goToPage("_test/editor");
  });
  describe("editor", () => {
    beforeAll(async () => {
      await goToPage("_test/editor");

      // wait until schema and data loaded
      await driver.wait(
        until.elementLocated(ByUIClass("codeEditor_codeEditor"))
      );
    });
    test("enter invalid query: InvalidReferenceError", async () => {
      const editor = await driver.findElement(By.className("cm-content"));
      await editor.sendKeys(
        "select Movie { title } filter .releaseyear = 2015"
      );

      // run the query
      const runButton = await driver.findElement(ByUIClass("repl_runButton"));
      await runButton.click();

      const errorElement = driver.wait(
        until.elementLocated(ByUIClass("repl_queryError"))
      );

      const errorName = await errorElement.findElement(
        ByUIClass("repl_errorName")
      );

      expect(
        (await errorName.getText()).includes("InvalidReferenceError")
      ).toBe(true);

      const errorHint = await errorElement.findElement(
        ByUIClass("repl_errorHint")
      );

      expect(await errorHint.getText()).toBe(
        "Hint: did you mean 'release_year'?"
      );
    });

    test("enter invalid query: EdgeQLSyntaxError", async () => {
      const editor = await driver.findElement(By.className("cm-content"));
      await editor.clear();
      await editor.sendKeys(
        "select Movie { title } filter .releaseyear = 2015)"
      );

      // run the query
      const runButton = await driver.findElement(ByUIClass("repl_runButton"));
      await runButton.click();

      const errorElement = driver.wait(
        until.elementLocated(ByUIClass("repl_queryError"))
      );

      const errorName = await errorElement.findElement(
        ByUIClass("repl_errorName")
      );

      expect((await errorName.getText()).includes("EdgeQLSyntaxError")).toBe(
        true
      );
    });

    test("enter valid query and get results", async () => {
      const editor = await driver.findElement(By.className("cm-content"));
      await editor.clear();
      await editor.sendKeys(
        "select Movie { title } filter .release_year = 2015"
      );

      // run the query
      const runButton = await driver.findElement(ByUIClass("repl_runButton"));
      runButton.click();

      const inspector = driver.wait(
        until.elementLocated(ByUIClass("repl_inspector"))
      );

      const results = await inspector.findElements(
        ByUIClass("inspector_scalar_string")
      );

      expect(await results[0].getText()).toBe("Ant-Man");
      expect(await results[1].getText()).toBe("Avengers: Age of Ultron");
    });

    test("there should be copy buttons for the whole result and for all its parts", async () => {
      const inspector = driver.wait(
        until.elementLocated(ByUIClass("repl_inspector"))
      );

      const copyButtons = await inspector.findElements(
        ByUIClass("inspector_copyButton")
      );

      // there should be copy options for the whole result and every result's parts and their parts
      expect(await copyButtons.length).toBe(5);
      expect(await copyButtons[0].getAttribute("innerText")).toBe("COPY");

      //copy the whole result to the clipboard
      await copyButtons[0].click();
      expect(await copyButtons[0].getAttribute("innerText")).toBe("COPIED");
    });

    test("when clicking on view button, new window is opened", async () => {
      const inspector = driver.wait(
        until.elementLocated(ByUIClass("repl_inspector"))
      );

      const viewButtons = await inspector.findElements(
        ByUIClass("inspector_openExtendedButton")
      );

      expect(await viewButtons[0].getAttribute("innerText")).toBe(" VIEW");

      await viewButtons[0].click();

      // wait for the view window to open
      const viewer = await driver.wait(
        until.elementLocated(ByUIClass("repl_extendedViewerContainer"))
      );

      // linewrap / show whitespace
      const actionButtons = await viewer.findElements(
        ByUIClass("shared_actionButton")
      );

      expect(await actionButtons.length).toBe(2);
      expect(await actionButtons[0].getAttribute("innerText")).toBe(
        "LINEWRAP"
      );
      expect(await actionButtons[1].getAttribute("innerText")).toBe(
        "SHOW WHITESPACE"
      );

      (await viewer.findElement(ByUIClass("shared_closeAction"))).click();

      waitUntilElementNotLocated(ByUIClass("repl_extendedViewerContainer"));
    });

    test("open history and choose item to edit", async () => {
      // save the current editor text to be able to compare it later with the other one from history
      const editor = await driver.findElement(By.className("cm-content"));
      const draftQuery = await editor.getText();

      (await driver.findElement(ByUIClass("repl_historyButton"))).click();

      const history = await driver.wait(
        until.elementLocated(ByUIClass("repl_history"))
      );

      // click on first history query (that is not draft query)
      (await history.findElements(ByUIClass("repl_historyItem")))[1].click();

      // click on edit button
      (await history.findElement(ByUIClass("repl_editButton"))).click();

      expect(editor.getText()).not.toBe(draftQuery);

      // history sidebar is closed
      waitUntilElementNotLocated(ByUIClass("repl_history"));
    });

    test("open history and choose item to edit by double clicking it", async () => {
      // save the current editor text to be able to compare it later with the other one from history
      const editor = await driver.findElement(By.className("cm-content"));
      const draftQuery = await editor.getText();

      (await driver.findElement(ByUIClass("repl_historyButton"))).click();

      await driver.wait(until.elementLocated(ByUIClass("repl_history")));

      // click on 2nd history query
      const historyItems = await driver.findElements(
        ByUIClass("repl_historyItem")
      );

      await driver
        .actions({async: true})
        .doubleClick(historyItems[2])
        .perform();

      expect(editor.getText()).not.toBe(draftQuery);

      // history sidebar is closed
      waitUntilElementNotLocated(ByUIClass("repl_history"));
    });
  });

  describe("builder", () => {
    beforeAll(async () => {
      await driver.wait(until.elementLocated(ByUIClass("repl_tabs")));
      const editorTabs = await driver.findElements(ByUIClass("repl_tab"));
      // click on builder tab
      await driver.actions({async: true}).click(editorTabs[1]).perform();
      // wait for builder window to show
      await driver.wait(
        until.elementLocated(ByUIClass("queryBuilder_queryBuilder"))
      );
    });
    test("queryBuilder renders correctly", async () => {
      await driver.wait(until.elementLocated(ByUIClass("repl_tabs")));
      const editorTabs = await driver.findElements(ByUIClass("repl_tab"));
      // click on builder tab
      await driver.actions({async: true}).click(editorTabs[1]).perform();
      // wait for builder window to show
      await driver.wait(
        until.elementLocated(ByUIClass("queryBuilder_queryBuilder"))
      );
      // select keyword should be shown
      const selectKeyword = await driver.findElement(
        ByUIClass("queryBuilder_keyword")
      );
      expect(await selectKeyword.getText()).toBe("select");
      // select dropdown with all existing db objects should be shown
      await driver.findElement(
        By.css(`${uiClass("select_select")}${uiClass("select_fullButton")}`)
      );
      // id checkbox should exists
      const idCheckbox = await driver.findElement(
        ByUIClass("queryBuilder_inactive")
      );
      expect(await idCheckbox.getText()).toBe("id");
      // 4 query modifiers should be visible
      const modButtons = await driver.findElements(
        ByUIClass("queryBuilder_modButton")
      );
      expect(await modButtons.length).toBe(4);
      expect(await modButtons[0].getText()).toBe("filter");
      expect(await modButtons[1].getText()).toBe("order by");
      expect(await modButtons[2].getText()).toBe("offset");
      expect(await modButtons[3].getText()).toBe("limit");
    });
  });
});
