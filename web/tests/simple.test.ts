import {ByUIClass, client, goToPage} from "./_utils";

test("select version query", async () => {
  await goToPage("edgedb/editor");

  const editor = await driver.findElement(By.className("cm-content"));
  await editor.sendKeys("select sys::get_version_as_str()");

  const runButton = driver.findElement(ByUIClass("repl_runButton"));
  await runButton.click();

  const versionStrEl = await driver.wait(
    until.elementLocated(ByUIClass("inspector_scalar_string"))
  );

  expect(await versionStrEl.getText()).toBe(
    await client.querySingle(`select sys::get_version_as_str()`)
  );
});
