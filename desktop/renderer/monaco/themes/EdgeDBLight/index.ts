import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

export const tokenColours = [
  {token: "source", foreground: "#333333"},
  {token: "comment", foreground: "#7f7f7f"},
  {token: "keyword", foreground: "#e72525"},
  {token: "constant", foreground: "#be65cd"},
  {token: "string", foreground: "#1a8f66"},
  {token: "support", foreground: "#0075d2"},
  {token: "punctuation", foreground: "#333333"},
  {token: "storage", foreground: "#0075d2"},
  {token: "invalid", foreground: "#e72525"},
  {token: "entity", foreground: "#333333"},
  {token: "meta", foreground: "#0075d2"},
  {token: "punctuation.definition.string", foreground: "#1a8f66"},
  {token: "punctuation.definition.comment", foreground: "#7f7f7f"},
  {token: "constant.language.variable", foreground: "#d78100"},
];

monaco.editor.defineTheme("EdgeDB-Light", {
  inherit: false,
  base: "vs",
  colors: {
    "editor.background": "#fafafa",
  },
  rules: tokenColours,
});
