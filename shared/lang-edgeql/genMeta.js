import {execFileSync} from "child_process";
import {writeFileSync} from "fs";

const stdout = execFileSync("edb", ["gen-meta-grammars", "edgeql"], {
  encoding: "utf8",
});

const output = [];

let inGroup = false;
for (const line of stdout.split("\n")) {
  if (!inGroup) {
    const match = line.match(/(.+)\s+=\s+\(/);
    if (match) {
      output.push(`export const ${match[1].trim()} = [`);
      inGroup = true;
    }
  } else {
    if (line.trim() === ")") {
      output.push("];\n");
      inGroup = false;
    } else {
      output.push(`  ${line.trim()}`);
    }
  }
}

writeFileSync("./meta.js", output.join("\n"));
