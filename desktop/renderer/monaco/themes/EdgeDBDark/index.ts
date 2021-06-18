import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

export const tokenColours = [
  {token: "source", foreground: "#e5e5e5"},
  {token: "comment", foreground: "#7f7f7f"},
  {token: "keyword", foreground: "#f13f4a"},
  {token: "constant", foreground: "#ac86f6"},
  {token: "string", foreground: "#07a66d"},
  {token: "support", foreground: "#369ff2"},
  {token: "punctuation", foreground: "#e5e5e5"},
  {token: "storage", foreground: "#369ff2"},
  {token: "invalid", foreground: "#f13f4a"},
  {token: "entity", foreground: "#e5e5e5"},
  {token: "meta", foreground: "#369ff2"},
  {token: "punctuation.definition.string", foreground: "#07a66d"},
  {token: "punctuation.definition.comment", foreground: "#7f7f7f"},
  {token: "constant.language.variable", foreground: "#f4e570"},
];

monaco.editor.defineTheme("EdgeDB-Dark", {
  inherit: false,
  base: "vs-dark",
  colors: {
    "editor.background": "#272727",
  },
  rules: tokenColours,
});
