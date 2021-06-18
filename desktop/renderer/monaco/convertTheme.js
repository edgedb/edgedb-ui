const fs = require("fs");
const plist = require("plist");

const outPath = process.argv[2];
const filetype = process.argv[3] || "json";
const path = (process.argv[4] || "tokenColors").split(".");

async function read(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

(async () => {
  let stdinData;
  try {
    stdinData = await read(process.stdin);
    if (!stdinData) {
      throw new Error();
    }
  } catch {
    throw new Error("No input theme on stdin");
  }

  const inputTheme =
    filetype === "json"
      ? JSON.parse(stdinData)
      : filetype === "plist" || filetype === "tmTheme"
      ? plist.parse(stdinData)
      : null;

  if (!inputTheme) {
    throw new Error("Unknown input type");
  }

  let inTokenColours = inputTheme;
  for (let i = 0; i < path.length; i++) {
    inTokenColours = inTokenColours[path[i]];
  }

  if (!Array.isArray(inTokenColours)) {
    throw new Error("tokenColors is not an array");
  }

  const outTokenColours = [];

  for (const tokenColour of inTokenColours) {
    let scopes =
      typeof tokenColour.scope === "string"
        ? tokenColour.scope.split(/,| /g).filter((s) => s.trim().length > 1)
        : Array.isArray(tokenColour.scope)
        ? tokenColour.scope
        : null;
    if (scopes) {
      for (const scope of scopes) {
        outTokenColours.push({
          token: scope.trim(),
          ...tokenColour.settings,
        });
      }
    }
  }

  const outputTheme = {
    inherit: true,
    base: "vs-dark",
    colors: {},
    rules: outTokenColours,
  };

  fs.writeFileSync(outPath, JSON.stringify(outputTheme, null, 2));
})();
