import {highlight as prism, languages} from "prismjs";

require("./auto-grammars");

export const highlighter = (code: string) =>
  prism(code, languages.edgeql, "edgeql");
