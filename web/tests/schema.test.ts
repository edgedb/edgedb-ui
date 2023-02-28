import {ByUIClass, goToPage} from "./_utils";

const getTypeName = (header: string) => {
  const secondPart = header.substring(header.indexOf("type") + 5);
  const emptySpaceIndex = secondPart.indexOf(" ");
  return secondPart.substring(0, emptySpaceIndex);
};

describe("Schema:", () => {
  beforeAll(async () => {
    await goToPage("_test/schema");

    // wait for data and schema to load
    await driver.wait(until.elementLocated(ByUIClass("textView_moduleItem")));
  });

  test("check basic UI", async () => {
    const filterControls = await driver.findElement(
      ByUIClass("textView_filterControls")
    );
    const filters = await filterControls.findElements(
      ByUIClass("textView_filterSelect")
    );

    //  2 filter dropdowns rendered
    expect(filters.length).toBe(2);

    // there is search input rendered
    await filterControls.findElement(
      By.xpath("//input[@placeholder='search...']")
    );

    // search filter with expected options
    expect(
      await (
        await filters[0].findElement(ByUIClass("textView_filterSelectName"))
      ).getText()
    ).toBe("Schema");

    const schemaOptions = await filters[0].findElement(
      ByUIClass("select_tabDropdown")
    );

    const schemaDropdownItems = await schemaOptions.findElements(
      ByUIClass("textView_selectItem")
    );

    expect(schemaDropdownItems.length).toBe(3);

    // types filter with expected options
    expect(
      await (
        await filters[1].findElement(ByUIClass("textView_filterSelectName"))
      ).getText()
    ).toBe("Types");

    const typesOptions = await filters[1].findElement(
      ByUIClass("select_tabDropdown")
    );

    const typesDropdownItems = await typesOptions.findElements(
      ByUIClass("select_dropdownItem")
    );

    expect(typesDropdownItems.length).toBe(7);
  });

  test("'show in graph' button change focus inside graph", async () => {
    // find second type (first one is already selected in the graph)
    const typesItems = await driver.findElements(
      ByUIClass("textView_typeItem")
    );

    const typeHeaderText = await (
      await typesItems[1].findElement(ByUIClass("textView_copyHighlight"))
    ).getText();

    const typeName = getTypeName(typeHeaderText);

    // click show in graph button
    await typesItems[1]
      .findElement(ByUIClass("textView_showInGraphButton"))
      .click();

    // find and check selected node in the graph window
    const selectedNode = await driver.findElement(
      ByUIClass("schemaGraph_selectedNode")
    );

    expect(
      await (
        await selectedNode.findElement(ByUIClass("schemaGraph_header"))
      ).getText()
    ).toBe(typeName);
  });
});
