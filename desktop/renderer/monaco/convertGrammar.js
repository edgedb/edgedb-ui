const fs = require("fs");
const plist = require("plist");

const outPath = process.argv[2];

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
    throw new Error("No input data on stdin");
  }

  const parsedGrammar = plist.parse(stdinData);

  fs.writeFileSync(outPath, JSON.stringify(parsedGrammar, null, 2));
})();
