const fs = require("fs");
const open = require("open");

open(
  `http://localhost:3000/ui/?authToken=${fs
    .readFileSync("./devkeys/jwt", "utf8")
    .trim()}`
);
